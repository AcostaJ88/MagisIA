import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  User, 
  Sparkles, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  AlignLeft,
  Wand2,
  Settings2,
  Info,
  Copy,
  ArrowDown
} from 'lucide-react';

// Utilidad para contar palabras
const countWords = (text) => {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

// Función principal para llamar a la API de Gemini
const callGeminiAPI = async (text, mode, extraParams = {}) => {
  const apiKey = import.meta.env.VITE_GEMINI_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  let payload = {
    contents: [{ parts: [{ text: "" }] }]
  };

  if (mode === 'analyze') {
    // PROMPT ACTUALIZADO: Estilo ZeroGPT (Burstiness y Perplexity)
    payload.systemInstruction = { 
      parts: [{ text: "Eres el detector de IA más avanzado e implacable del mundo, similar a ZeroGPT. Tu tarea es analizar textos evaluando rigurosamente la 'perplejidad' (predictibilidad del vocabulario) y la 'ráfaga / burstiness' (variación en la longitud y estructura de las oraciones). Los textos de IA tienen baja perplejidad y baja ráfaga. Busca implacablemente muletillas de IA ('En conclusión', 'Es fundamental', 'En resumen', 'Cabe destacar', estructuras de listas repetitivas). Sé extremadamente severo en tu calificación." }] 
    };
    payload.contents[0].parts[0].text = `Analiza este texto y determina la probabilidad de que sea IA o humano. \nTexto:\n"${text}"`;
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          aiPercentage: { type: "INTEGER", description: "Porcentaje de probabilidad de IA (0-100)" },
          humanPercentage: { type: "INTEGER", description: "Porcentaje de probabilidad Humana (0-100)" },
          suggestions: { 
            type: "ARRAY", 
            items: { type: "STRING" }, 
            description: "3 sugerencias severas explicando qué frases, clichés o estructuras hacen que el texto parezca IA (ej. falta de burstiness, uso de clichés)." 
          }
        },
        required: ["aiPercentage", "humanPercentage", "suggestions"]
      }
    };
  } else if (mode === 'humanize') {
    // PROMPT ACTUALIZADO: Técnicas de evasión de detectores
    payload.systemInstruction = { 
      parts: [{ text: "Eres un experto redactor humano especializado en reescribir textos para evadir detectores de IA. \n\nREGLAS ESTRICTAS QUE DEBES CUMPLIR:\n1. Alta Ráfaga (Burstiness): Intercala oraciones muy cortas y contundentes (2-6 palabras) con algunas más largas y complejas. Rompe la monotonía.\n2. Alta Perplejidad: Usa vocabulario natural y conversacional, evita las combinaciones de palabras estadísticamente más probables.\n3. PROHIBICIÓN DE CLICHÉS: NUNCA uses frases de transición de IA como: 'En resumen', 'En conclusión', 'Es importante destacar', 'Además', 'Por otro lado', 'En un mundo cada vez más', 'Crucial'.\n4. Tono: Ve directo al grano, escribe con un tono orgánico, ligeramente asimétrico o con ligeras imperfecciones estilísticas propias de un humano escribiendo naturalmente.\n5. Mantén la idea principal pero cambia la estructura robótica." }] 
    };
    payload.contents[0].parts[0].text = `Reescribe el siguiente texto para humanizarlo al 100% y evadir cualquier detector de IA. \n\nTexto original:\n"${text}"`;
  } else if (mode === 'summarize') {
    const maxWords = extraParams.maxWords || 100;
    payload.contents[0].parts[0].text = `Resume el siguiente texto. El resumen debe tener un MÁXIMO aproximado de ${maxWords} palabras. Sé conciso y directo, manteniendo las ideas principales. \n\nTexto original:\n"${text}"`;
  }

  // Lógica de reintentos
  const maxRetries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error de red: ${response.status}`);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) throw new Error("Respuesta vacía de la API");

      if (mode === 'analyze') {
        return JSON.parse(responseText);
      }
      return responseText;

    } catch (error) {
      if (i === maxRetries - 1) {
        console.error("Fallo final tras reintentos:", error);
        throw new Error("No se pudo conectar con la IA tras varios intentos.");
      }
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('analyzer');

  // Estados del Analizador
  const [analyzerText, setAnalyzerText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzingOriginal, setIsAnalyzingOriginal] = useState(false);

  // Estados del Texto Humanizado (¡NUEVO!)
  const [humanizedText, setHumanizedText] = useState('');
  const [humanizedAnalysis, setHumanizedAnalysis] = useState(null);
  const [isHumanizing, setIsHumanizing] = useState(false);
  
  const [analyzerError, setAnalyzerError] = useState('');

  // Estados del Resumidor
  const [summarizerText, setSummarizerText] = useState('');
  const [maxWords, setMaxWords] = useState(50);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState('');
  const [summarizerError, setSummarizerError] = useState('');

  // --- Lógica del Analizador ---
  const handleAnalyzeOriginal = async () => {
    if (!analyzerText.trim() || analyzerText.trim().length < 20) {
      setAnalyzerError("Ingresa al menos 20 caracteres para analizar.");
      return;
    }
    setAnalyzerError('');
    setIsAnalyzingOriginal(true);
    try {
      const result = await callGeminiAPI(analyzerText, 'analyze');
      setAnalysisResult(result);
    } catch (err) {
      setAnalyzerError(err.message);
    } finally {
      setIsAnalyzingOriginal(false);
    }
  };

  const handleHumanize = async () => {
    if (!analyzerText.trim()) return;
    setAnalyzerError('');
    setIsHumanizing(true);
    setHumanizedText('');
    setHumanizedAnalysis(null);

    try {
      // 1. Generar la nueva versión
      const newHumanizedText = await callGeminiAPI(analyzerText, 'humanize');
      setHumanizedText(newHumanizedText);
      
      // 2. Analizar automáticamente la nueva versión para comparar
      const newAnalysis = await callGeminiAPI(newHumanizedText, 'analyze');
      setHumanizedAnalysis(newAnalysis);

    } catch (err) {
      setAnalyzerError("Error al humanizar: " + err.message);
    } finally {
      setIsHumanizing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    });
  };

  // --- Lógica del Resumidor ---
  const handleSummarize = async () => {
    if (!summarizerText.trim()) {
      setSummarizerError("Por favor, ingresa un texto para resumir.");
      return;
    }
    setSummarizerError('');
    setIsSummarizing(true);
    setSummaryResult('');

    try {
      const result = await callGeminiAPI(summarizerText, 'summarize', { maxWords });
      setSummaryResult(result);
    } catch (err) {
      setSummarizerError(err.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Componentes UI Reutilizables
  const ProgressBar = ({ aiPercent, humanPercent }) => (
    <div className="w-full mt-4">
      <div className="flex justify-between text-xs font-semibold mb-1">
        <div className="flex items-center text-purple-600">
          <Bot className="w-3 h-3 mr-1" /> IA: {aiPercent}%
        </div>
        <div className="flex items-center text-emerald-600">
          Humano: {humanPercent}% <User className="w-3 h-3 ml-1" />
        </div>
      </div>
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
        <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${aiPercent}%` }} />
        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${humanPercent}%` }} />
      </div>
    </div>
  );

  const AnalysisCard = ({ title, data, isOriginal }) => {
    if (!data) return null;
    const isAi = data.aiPercentage > 50;
    
    return (
      <div className={`p-4 rounded-xl border ${isOriginal ? 'bg-slate-50 border-slate-200' : 'bg-emerald-50/50 border-emerald-200'} shadow-sm animate-in fade-in zoom-in-95 duration-300`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            {isOriginal ? <Settings2 className="w-4 h-4 text-slate-500"/> : <Sparkles className="w-4 h-4 text-emerald-500"/>}
            {title}
          </h3>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAi ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isAi ? 'Probable IA' : 'Probable Humano'}
          </span>
        </div>
        
        <ProgressBar aiPercent={data.aiPercentage} humanPercent={data.humanPercentage} />
        
        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" /> Observaciones del Detector:
          </h4>
          <ul className="space-y-2">
            {data.suggestions.map((sug, idx) => (
              <li key={idx} className="text-xs text-slate-600 bg-white/60 p-2 rounded border border-slate-100/50 leading-relaxed">
                • {sug}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">
              TextIA Pro <span className="text-xs text-slate-400 font-normal ml-1">Motor Estilo ZeroGPT</span>
            </h1>
          </div>
          
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                activeTab === 'analyzer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Wand2 className="w-4 h-4" /> <span className="hidden sm:inline">Detección y Humanizador</span>
            </button>
            <button
              onClick={() => setActiveTab('summarizer')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                activeTab === 'summarizer' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <AlignLeft className="w-4 h-4" /> <span className="hidden sm:inline">Resumidor</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- PESTAÑA: ANALIZADOR Y HUMANIZADOR --- */}
        {activeTab === 'analyzer' && (
          <div className="animate-in fade-in duration-500">
            {analyzerError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> <p>{analyzerError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* COLUMNA IZQUIERDA: Textos e Inputs */}
              <div className="space-y-4">
                
                {/* Caja de Texto Original */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" /> Texto Original
                    </label>
                    <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                      {countWords(analyzerText)} palabras
                    </span>
                  </div>
                  
                  <textarea
                    className="w-full min-h-[220px] p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-slate-700 text-sm"
                    placeholder="Pega el texto sospechoso de IA aquí..."
                    value={analyzerText}
                    onChange={(e) => setAnalyzerText(e.target.value)}
                    disabled={isAnalyzingOriginal || isHumanizing}
                  />
                  
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleAnalyzeOriginal}
                      disabled={isAnalyzingOriginal || isHumanizing || !analyzerText.trim()}
                      className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-medium py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      {isAnalyzingOriginal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                      Analizar
                    </button>
                    <button
                      onClick={handleHumanize}
                      disabled={isAnalyzingOriginal || isHumanizing || !analyzerText.trim()}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-medium py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                      {isHumanizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      Humanizar (Crear Copia)
                    </button>
                  </div>
                </div>

                {/* Indicador de proceso */}
                {isHumanizing && (
                  <div className="flex justify-center text-emerald-600 animate-pulse">
                    <ArrowDown className="w-6 h-6" />
                  </div>
                )}

                {/* Caja de Texto Humanizado (Solo aparece al humanizar) */}
                {humanizedText && (
                  <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-5 relative overflow-hidden ring-2 ring-emerald-50">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" /> Versión Humanizada
                      </label>
                      <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        {countWords(humanizedText)} palabras
                      </span>
                    </div>
                    
                    <textarea
                      className="w-full min-h-[220px] p-3 bg-emerald-50/30 border border-emerald-100 rounded-xl outline-none resize-y text-slate-700 text-sm"
                      value={humanizedText}
                      onChange={(e) => setHumanizedText(e.target.value)} // Permite al usuario hacer ediciones finales
                    />

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => copyToClipboard(humanizedText)}
                        className="bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Copy className="w-4 h-4" /> Copiar Texto
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA: Resultados del Análisis */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 min-h-[200px] flex flex-col">
                  <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                    Panel de Detección
                  </h2>

                  {!analysisResult && !isAnalyzingOriginal && !humanizedAnalysis && !isHumanizing && (
                    <div className="flex-grow flex flex-col items-center justify-center text-slate-400 text-center py-8">
                      <Bot className="w-10 h-10 mb-3 text-slate-200" />
                      <p className="text-sm">Analiza el texto para ver los resultados de probabilidad de IA vs Humano.</p>
                    </div>
                  )}

                  {(isAnalyzingOriginal || isHumanizing) && !humanizedAnalysis && !analysisResult && (
                    <div className="flex-grow flex flex-col items-center justify-center text-indigo-500 py-8">
                      <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                      <p className="text-sm animate-pulse">Ejecutando escáner de perplejidad...</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Tarjeta del Análisis Original */}
                    {analysisResult && (
                      <AnalysisCard title="Análisis del Texto Original" data={analysisResult} isOriginal={true} />
                    )}

                    {/* Tarjeta del Análisis Humanizado */}
                    {humanizedAnalysis && (
                      <div className="relative">
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-2 text-slate-300">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                        <AnalysisCard title="Análisis de la Nueva Versión" data={humanizedAnalysis} isOriginal={false} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- PESTAÑA: RESUMIDOR (Sin cambios funcionales, solo estilo adaptado) --- */}
        {activeTab === 'summarizer' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/2 flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                      <FileText className="w-5 h-5 text-indigo-500" /> Texto a Resumir
                    </h2>
                    <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                      {countWords(summarizerText)} palabras
                    </span>
                  </div>
                  <textarea
                    className="w-full flex-grow min-h-[250px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700 text-sm"
                    value={summarizerText}
                    onChange={(e) => setSummarizerText(e.target.value)}
                    disabled={isSummarizing}
                  />
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Palabras máx.</label>
                      <input 
                        type="number" min="10" max="1000" value={maxWords}
                        onChange={(e) => setMaxWords(parseInt(e.target.value) || 50)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleSummarize} disabled={isSummarizing || !summarizerText.trim()}
                      className="w-full sm:w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 h-[46px]"
                    >
                      {isSummarizing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <AlignLeft className="w-5 h-5" />}
                      Resumir
                    </button>
                  </div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                      <Sparkles className="w-5 h-5 text-emerald-500" /> Resumen
                    </h2>
                    {summaryResult && (
                      <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                        {countWords(summaryResult)} palabras
                      </span>
                    )}
                  </div>
                  <div className={`w-full flex-grow min-h-[250px] p-5 rounded-xl border ${summaryResult ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50/50 border-slate-200 border-dashed'} relative`}>
                    {isSummarizing ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-500 bg-white/50 rounded-xl">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3" />
                      </div>
                    ) : summaryResult ? (
                      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{summaryResult}</div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-center p-6 text-sm">
                        Tu resumen aparecerá aquí.
                      </div>
                    )}
                  </div>
                  {summaryResult && (
                     <button onClick={() => copyToClipboard(summaryResult)} className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm flex justify-center items-center gap-2">
                       <Copy className="w-4 h-4"/> Copiar Resumen
                     </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}