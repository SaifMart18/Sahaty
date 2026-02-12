
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface NutritionInfo {
  calories: string | number;
  protein: string | number;
  carbohydrates: string | number;
  sugar: string | number;
  fat: string | number;
}

interface AnalysisResult {
  product_name: string;
  ingredients: string[];
  nutrition: NutritionInfo;
  allergens: string[];
  health_grade: 'A' | 'B' | 'C' | 'D' | 'E';
  health_summary: string;
  timestamp?: number;
}

// --- Icons ---
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

// --- App Component ---
const App = () => {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sehati_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('sehati_history', JSON.stringify(history));
  }, [history]);

  // Gemini API Logic
  const analyzeProduct = async (base64Image: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `You are a nutrition expert AI assistant.
Task:
- Analyze the food product image provided.
- Identify the product name in Arabic.
- Extract ingredients list in Arabic.
- Calculate nutrition per 100g (Calories, Protein, Carbs, Sugar, Fat).
- Identify allergens in Arabic.
- Provide a Health Grade (A: Excellent, B: Good, C: Average, D: Poor, E: Unhealthy) based on ingredients and nutrition.
- Provide a 1-sentence health summary in Arabic.
- Return ONLY valid JSON with this structure:
{
  "product_name": "اسم المنتج",
  "ingredients": ["مكون 1", "مكون 2"],
  "nutrition": {
    "calories": "number",
    "protein": "number",
    "carbohydrates": "number",
    "sugar": "number",
    "fat": "number"
  },
  "allergens": ["مسبب حساسية 1"],
  "health_grade": "A|B|C|D|E",
  "health_summary": "ملخص صحي قصير"
}`;

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image.split(',')[1]
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [imagePart, { text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || '{}') as AnalysisResult;
      const resultWithMeta = { ...data, timestamp: Date.now() };
      setResult(resultWithMeta);
      setHistory(prev => [resultWithMeta, ...prev].slice(0, 10)); // Keep last 10
    } catch (err: any) {
      console.error(err);
      setError("حدث خطأ أثناء تحليل الصورة. يرجى التأكد من وضوح الملصق الغذائي.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("لا يمكن الوصول للكاميرا. يرجى منح الإذن.");
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
        setResult(null);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const deleteHistoryItem = (index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  const getGradeColor = (grade: string) => {
    switch(grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-lime-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'E': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFD700] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.5)]">
            <span className="text-[#0F0F0F] font-black text-xl">ص</span>
          </div>
          <h1 className="text-3xl font-bold text-[#FFD700]">صحتي</h1>
        </div>
        <div className="text-sm text-gray-400 bg-[#1E1E1E] px-4 py-2 rounded-full glass border border-white/5">
          مستشارك الغذائي الذكي
        </div>
      </header>

      {/* Upload Section */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className={`relative h-96 glass rounded-3xl flex flex-col items-center justify-center border-2 border-dashed ${image ? 'border-transparent' : 'border-[#FFD700]/20'} overflow-hidden transition-all duration-500`}>
            {showCamera ? (
              <div className="absolute inset-0 z-10 bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none border-2 border-[#FFD700]/30 m-8 rounded-2xl flex items-center justify-center">
                  <div className="w-full h-0.5 bg-[#FFD700]/50 absolute animate-[scan_2s_infinite]"></div>
                </div>
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                  <button onClick={capturePhoto} className="bg-[#FFD700] text-black w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                    <div className="w-12 h-12 rounded-full border-2 border-black"></div>
                  </button>
                  <button onClick={stopCamera} className="bg-white/10 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold border border-white/20">إلغاء</button>
                </div>
              </div>
            ) : image ? (
              <div className="relative w-full h-full">
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
                {analyzing && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
                    <div className="relative w-48 h-48 border-2 border-[#FFD700]/50 rounded-lg overflow-hidden">
                       <div className="absolute w-full h-1 bg-[#FFD700] shadow-[0_0_15px_#FFD700] animate-[scan_2s_infinite]"></div>
                    </div>
                    <p className="mt-6 text-[#FFD700] font-bold animate-pulse">جاري تحليل البيانات...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="mb-6 w-20 h-20 bg-[#FFD700]/5 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <UploadIcon />
                </div>
                <p className="text-xl font-semibold text-gray-200 mb-2">ارفع صورة المنتج</p>
                <p className="text-sm text-gray-500">قم بتصوير جدول الحقائق الغذائية بوضوح</p>
              </div>
            )}
            
            {image && !showCamera && !analyzing && (
              <button 
                onClick={() => {setImage(null); setResult(null);}} 
                className="absolute top-4 left-4 bg-black/60 backdrop-blur-md p-2 rounded-full hover:bg-black/90 transition border border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <div className="flex flex-col justify-center gap-4">
            <h2 className="text-2xl font-bold mb-2">ابدأ الفحص</h2>
            <button 
              onClick={startCamera}
              className="flex items-center justify-center gap-3 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white py-5 px-6 rounded-3xl border border-white/5 transition-all neo-button"
            >
              <div className="p-2 bg-[#FFD700]/10 rounded-lg text-[#FFD700]">
                <CameraIcon />
              </div>
              <div className="text-right flex-1">
                <div className="font-bold">استخدام الكاميرا</div>
                <div className="text-xs text-gray-500">التقاط سريع ومباشر للمنتج</div>
              </div>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white py-5 px-6 rounded-3xl border border-white/5 transition-all neo-button"
            >
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                <UploadIcon />
              </div>
              <div className="text-right flex-1">
                <div className="font-bold">اختيار من الاستوديو</div>
                <div className="text-xs text-gray-500">رفع صورة مخزنة مسبقاً</div>
              </div>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*" 
            />

            {image && (
              <button 
                onClick={() => analyzeProduct(image)}
                disabled={analyzing}
                className={`mt-4 py-5 px-6 rounded-3xl font-black text-lg transition-all shadow-[0_10px_20px_rgba(255,215,0,0.2)] ${analyzing ? 'bg-gray-800 cursor-not-allowed text-gray-500' : 'bg-[#FFD700] text-[#0F0F0F] hover:scale-[1.02] active:scale-95'}`}
              >
                {analyzing ? 'جاري التحليل...' : 'تحليل المنتج الآن'}
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-5 rounded-2xl mb-8 flex items-center gap-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertIcon />
          </div>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Results Dashboard */}
      {result && (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="mb-8 p-6 glass rounded-3xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-full ${getGradeColor(result.health_grade)} opacity-10 blur-2xl`}></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-4xl font-black text-white">{result.product_name}</h2>
                  <span className="text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/20 px-4 py-1 rounded-full text-sm font-bold tracking-wide">جديد</span>
                </div>
                <p className="text-gray-400 text-lg leading-relaxed">{result.health_summary}</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-center">
                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1">التقييم الصحي</div>
                    <div className={`w-20 h-20 rounded-2xl ${getGradeColor(result.health_grade)} text-[#0F0F0F] flex items-center justify-center text-4xl font-black shadow-lg border-4 border-white/10`}>
                      {result.health_grade}
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: 'السعرات', value: result.nutrition.calories, unit: 'سعرة' },
                { label: 'بروتين', value: result.nutrition.protein, unit: 'جم' },
                { label: 'كربوهيدرات', value: result.nutrition.carbohydrates, unit: 'جم' },
                { label: 'سكر', value: result.nutrition.sugar, unit: 'جم' },
                { label: 'دهون', value: result.nutrition.fat, unit: 'جم' },
              ].map((item, idx) => (
                <div key={idx} className="glass p-5 rounded-3xl text-center border border-white/5 hover:border-[#FFD700]/30 transition-colors">
                  <div className="text-[#FFD700] text-xs mb-2 font-bold opacity-70 uppercase tracking-tighter">{item.label}</div>
                  <div className="text-3xl font-black mb-1">{item.value}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">{item.unit}</div>
                </div>
              ))}
            </div>

            <div className="glass p-6 rounded-3xl border-r-4 border-red-500/50 bg-red-500/5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                  <AlertIcon />
                </div>
                <h3 className="font-black text-white">الحساسية</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.allergens && result.allergens.length > 0 && result.allergens[0] !== "لا يوجد" ? (
                  result.allergens.map((allergy, idx) => (
                    <span key={idx} className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl text-xs font-bold">
                      {allergy}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">آمن من مسببات الحساسية المعروفة</span>
                )}
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-3xl border border-white/5">
            <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#FFD700]/10 text-[#FFD700] rounded-lg flex items-center justify-center text-sm italic">i</span>
              قائمة المكونات
            </h3>
            <div className="flex flex-wrap gap-3">
              {result.ingredients.map((ingredient, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl text-sm text-gray-300 font-medium hover:bg-white/10 transition-colors">
                  {ingredient}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <section className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-gray-200">سجل عمليات الفحص</h3>
            <button 
              onClick={() => { if(confirm('هل تريد مسح السجل؟')) setHistory([]); }}
              className="text-gray-500 hover:text-red-400 transition-colors text-sm flex items-center gap-2"
            >
              مسح الكل
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => {setResult(item); window.scrollTo({ top: 400, behavior: 'smooth' });}}
                className="glass p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/5 cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${getGradeColor(item.health_grade)} text-[#0F0F0F] flex items-center justify-center font-black text-xl`}>
                    {item.health_grade}
                  </div>
                  <div>
                    <div className="font-bold text-gray-200 group-hover:text-[#FFD700] transition-colors">{item.product_name}</div>
                    <div className="text-[10px] text-gray-500">{new Date(item.timestamp || 0).toLocaleString('ar-EG')}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => {e.stopPropagation(); deleteHistoryItem(idx);}}
                  className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-32 py-10 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse"></div>
          <span className="text-gray-400 font-bold tracking-widest text-xs uppercase">Sehati Platform 2024</span>
        </div>
        <p className="text-gray-600 text-sm">تطبيق صحتي يستخدم الذكاء الاصطناعي لتحسين جودة حياتك</p>
      </footer>

      <canvas ref={canvasRef} className="hidden" />
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

// --- Render ---
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
