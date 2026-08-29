import { useEffect, useState,useRef } from "react";
import SchedulerWorker from "./workers/schedule.worker.ts?worker&inline";
import * as htmlToImage from 'html-to-image';
import Coursegrid from "./CourseGrid";

type GroupedCourse = { [code: string]: any };
type Filters = {
  "no840": boolean,
  "day_offs":number[],
  "compact":boolean,
  "lunchBreak": boolean
}
const DAYS_map = {"Monday":0, "Tuesday":1, "Wednesday":2, "Thursday":3, "Friday":4};
function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });
  const [mobileWarningClosed, setMobileWarningClosed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mobileWarningClosed') === 'true';
    }
    return false;
  });
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const hasSeenGuide = typeof window !== 'undefined' && localStorage.getItem('suplanner_guide_seen');
    if (!hasSeenGuide) {
      const timer = setTimeout(() => setShowHelp(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCloseHelp = () => {
    setShowHelp(false);
    if (typeof window !== 'undefined') localStorage.setItem('suplanner_guide_seen', 'true');
  };

  const [savePreferences, setSavePreferences] = useState(() => {
    const saved = localStorage.getItem('suplanner_savePreferences');
    return saved === 'true';
  });

  const [courses, setCourses] = useState<GroupedCourse>({});
  const [autoCoreqs, setAutoCoreqs] = useState(() => {
    if (!savePreferences) return true; 
    const saved = localStorage.getItem('suplanner_autoCoreqs');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>(() => {
    if (!savePreferences) return [];
    const saved = localStorage.getItem('suplanner_selected');
    return saved ? JSON.parse(saved) : [];
  });
  const [pinnedSections, setPinnedSections] = useState<Record<string, string>>(() => {
    if (!savePreferences) return {};
    const saved = localStorage.getItem('suplanner_pinnedSections');
    return saved ? JSON.parse(saved) : {};
  });
  const [allowConflict, setAllowConflict] = useState<Record<string, string[]>>(() => {
    if (!savePreferences) return {};
    const saved = localStorage.getItem('suplanner_allowConflict');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  });
  const [schedules, setSchedules] = useState<any[][]>([]); 
  const [currentIndex, setCurrentIndex] = useState(0);     
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'cart' |'constraints'>('search'); 

  const [constraints, setConstraints] = useState<Filters>(() => {
    const defaultConstraints = {
      "no840": false,
      "day_offs": [],
      "compact": true,
      "lunchBreak": false
    };

    if (!savePreferences) return defaultConstraints;
    
    const saved = localStorage.getItem('suplanner_constraints');
    return saved ? JSON.parse(saved) : defaultConstraints;
  });

  const [dayOffsOpen, setDayOffsOpen] = useState<boolean>(() => {
    if (!savePreferences) return false;
    const saved = localStorage.getItem('suplanner_dayOffsOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [copied, setCopied] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);


  useEffect(() => {
    localStorage.setItem('suplanner_savePreferences', String(savePreferences));

    if (!savePreferences) {
      localStorage.removeItem('suplanner_autoCoreqs');
      localStorage.removeItem('suplanner_selected');
      localStorage.removeItem('suplanner_pinnedSections');
      localStorage.removeItem('suplanner_allowConflict');
      localStorage.removeItem('suplanner_constraints');
      localStorage.removeItem('suplanner_dayOffsOpen');
    } else {
      localStorage.setItem('suplanner_selected', JSON.stringify(selected));
      localStorage.setItem('suplanner_pinnedSections', JSON.stringify(pinnedSections));
    }
  }, [savePreferences]);



  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_autoCoreqs', JSON.stringify(autoCoreqs));
  }, [autoCoreqs, savePreferences]);

  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_selected', JSON.stringify(selected));
  }, [selected, savePreferences]);

  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_pinnedSections', JSON.stringify(pinnedSections));
  }, [pinnedSections, savePreferences]);

  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_allowConflict', JSON.stringify(allowConflict));
  }, [allowConflict, savePreferences]);

  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_constraints', JSON.stringify(constraints));
  }, [constraints, savePreferences]);

  useEffect(() => {
    if (savePreferences) localStorage.setItem('suplanner_dayOffsOpen', JSON.stringify(dayOffsOpen));
  }, [dayOffsOpen, savePreferences]);

  useEffect(() => {
    setLoadingCourses(true);
    fetch(import.meta.env.BASE_URL + 'data.json')
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoadingCourses(false);
      })
      .catch((err) => {
        console.error("API Error:", err);
        setLoadingCourses(false);
      });
  }, []);


  useEffect(() => {
  if (!dayOffsOpen) {
    setConstraints(prev => ({
      ...prev,
      day_offs: [],
    }));
  }
}, [dayOffsOpen]);


  const filteredCourses = Object.entries(courses).filter(([code]) =>
    code.toLowerCase().includes(filter.toLowerCase())
  );

  const handleClearAll = () => {
    setSelected([]);
    setPinnedSections({});
    setAllowConflict({});
  };

  const toggleCourse = (code: string) => {
    const isRemoving = selected.includes(code);
    const newSelected = new Set(selected);
    const course = courses[code];

    if (isRemoving) {
      const codesToRemove = [code, ...(autoCoreqs && course?.corequisites ? course.corequisites : [])];
      newSelected.delete(code);

      if (autoCoreqs && course?.corequisites) {
        course.corequisites.forEach((req: string) => newSelected.delete(req));
      }

      setAllowConflict(prev => {
        const next: Record<string, string[]> = {};
        for (const [courseCode, targets] of Object.entries(prev)) {
          if (codesToRemove.includes(courseCode)) continue;
          const filtered = targets.filter(t => !codesToRemove.includes(t));
          if (filtered.length > 0) next[courseCode] = filtered;
        }
        return next;
      });

    } else {
      newSelected.add(code);

      if (autoCoreqs && course?.corequisites) {
        course.corequisites.forEach((req: string) => newSelected.add(req));
      }
    }

    setSelected(Array.from(newSelected));
  };
  const toggleBoolean = (key:"no840" | "compact" | "lunchBreak") => {
    setConstraints(prev => ({
      ...prev,
      [key]:!prev[key],
    }))
  }
  const toggleArray = (key:"day_offs",value:number) => {
    setConstraints(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key],value],
    }))
  }
  const togglePin = (courseName: string, crn: string) => {
  setPinnedSections(prev => {
    if (prev[courseName] === crn) {
      const newState = { ...prev };
      delete newState[courseName];
      return newState;
    }
    return { ...prev, [courseName]: crn };
  });
  };
  const toggleAllowConflict = (code: string) => {
    setAllowConflict(prev => {
      const next = { ...prev };
      if (next[code]) delete next[code];
      else next[code] = [];
      return next;
    });
  };
  const toggleConflictTarget = (code: string, target: string) => {
    setAllowConflict(prev => {
      const current = prev[code] ?? [];
      return {
        ...prev,
        [code]: current.includes(target) ? current.filter(c => c !== target) : [...current, target],
      };
    });
  };
  const generateSchedule = () => { 
    if (selected.length === 0) return alert("Please select a course.");
    
    setLoading(true);
    setSchedules([]);
    setCurrentIndex(0);

    const worker = new SchedulerWorker();

    worker.postMessage({
      selected,
      courses,
      constraints,
      pinnedSections,
      allowConflict
    });

    worker.onmessage = (e) => {
      const { status, schedules: resultSchedules } = e.data;
      
      if (status === "success") {
        setSchedules(resultSchedules);
        setHasSearched(true);
      } else {
        console.error("Worker Error");
        alert("An error occurred during calculation.");
      }
      
      setLoading(false);
      worker.terminate(); 
    };

    worker.onerror = (err) => {
      console.error("Worker System Error:", err);
      setLoading(false);
      alert("Calculation failed.");
      worker.terminate();
    };
  };

  const handleCopyAllCRNs = () => {
    if (schedules.length === 0  || !schedules[currentIndex]) return;

    const currentSchedule = schedules[currentIndex];
    const formattedText = currentSchedule.map((course:any) => {
      const crnVal = course.crn || "???";
      return `${course.code} - ${course.section}: ${crnVal}`;
    }).join(",\n");

    if(formattedText){
      navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(()=> setCopied(false),2000)
    }


  };

  const handleDownload = async () => {
    if (!gridRef.current) return;

    const node = gridRef.current;
    const contentNode = node.firstElementChild as HTMLElement;

    const originalOverflow = node.style.overflow;
    const originalHeight = node.style.height;
    const originalWidth = node.style.width;

    const originalContentHeight = contentNode ? contentNode.style.height : "";

    try {
      node.classList.add(
        "overflow-visible",
        "[-ms-overflow-style:none]",
        "[scrollbar-width:none]",
        "[&::-webkit-scrollbar]:hidden"
      );

      const isDark = document.documentElement.classList.contains('dark');
      const exportWidth = 1280;
      node.style.width = `${exportWidth}px`;

      if (contentNode) {
        contentNode.style.height = "auto";
      }

      const exportHeight = contentNode ? contentNode.scrollHeight : node.scrollHeight;

      node.style.height = `${exportHeight}px`;

      const dataUrl = await htmlToImage.toPng(node, {
        backgroundColor: isDark ? "#0f172a" : "#ffffff",
        pixelRatio: 2,
        width: exportWidth,
        height: exportHeight,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
        }
      });

      const link = document.createElement("a");
      link.download = `schedule-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

    } catch (error) {
      console.error(error);
      alert("Error when downloading the image.");
    } finally {
      node.classList.remove(
        "overflow-visible",
        "[-ms-overflow-style:none]",
        "[scrollbar-width:none]",
        "[&::-webkit-scrollbar]:hidden"
      );

      node.style.overflow = originalOverflow;
      node.style.height = originalHeight;
      node.style.width = originalWidth;

      if (contentNode) {
        contentNode.style.height = originalContentHeight;
      }
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
      <div className="h-full w-full overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-7xl relative">
      
          <div className="w-88 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl z-20 ">
            
            <div className="p-5 pb-0 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Course Planner</h1>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Termcode: 202502</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHelp(true)}
                  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-yellow-400 dark:hover:bg-slate-800 transition-colors"
                  title="Help / Guide"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <button
                onClick={() => setSavePreferences(!savePreferences)}
                className={`
                  p-2 rounded-lg transition-all duration-300 relative group
                  ${savePreferences 
                    ? "text-sky-600 bg-sky-50 dark:bg-sky-900/30 ring-1 ring-sky-200 dark:ring-sky-800" 
                    : "text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:text-sky-400 dark:hover:bg-slate-800"
                  }
                `}
                title={savePreferences ? "Autosave is ON (your choices will remain after refresh)" : "Autosave is OFF"}
              >
                <svg className="w-5 h-5" fill={savePreferences ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  {savePreferences ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  )}
                </svg>

                {savePreferences && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                  </span>
                )}
              </button>

                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="group p-2 rounded-lg transition-all duration-200 
                  text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 
                  dark:hover:text-yellow-400 dark:hover:bg-slate-700/50"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label="Toggle Dark Mode"
                >
                  {darkMode ? (
                    <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 transform transition-transform group-hover:-rotate-12 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex px-5 mt-4 border-b border-slate-100 dark:border-slate-800 space-x-6">
              <button
                onClick={() => setActiveTab('search')}
                className={`pb-3 text-sm font-medium transition-all relative ${
                  activeTab === 'search' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Search Courses
                {activeTab === 'search' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"/>}
              </button>
              
              <button
                onClick={() => setActiveTab('cart')}
                className={`pb-3 text-sm font-medium transition-all relative ${
                  activeTab === 'cart' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Selected 
                <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full text-xs">
                  {selected.length}
                </span>
                {activeTab === 'cart' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"/>}
              </button>

              <button
                onClick={() => setActiveTab('constraints')}
                className={`pb-3 text-sm font-medium transition-all relative ${
                  activeTab === 'constraints' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Filters
                {activeTab === 'constraints' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"/>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
              
              {activeTab === 'search' && (
                <>
                  
                  <input
                    type="text"
                    placeholder="e.g.: MATH 101"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white mb-2 transition-all placeholder:text-slate-400"
                    onChange={(e) => setFilter(e.target.value)}
                    disabled={loadingCourses}
                  />
                  <div className="flex justify-start mb-2">
                    <button
                      onClick={() => setAutoCoreqs(!autoCoreqs)}
                      title="Automatically toggle main courses with Recits/Labs (IF 100 <=> IF 100R) "
                      className={`
                        flex items-center cursor-pointer gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all border
                        ${autoCoreqs 
                          ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800" 
                          : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${autoCoreqs ? "bg-indigo-500 animate-pulse" : "bg-slate-300"}`} />
                      {autoCoreqs ? "Auto-Coreqs ON" : "Auto-Coreqs OFF"}
                    </button>
                  </div>

                  {loadingCourses ? (
                    <>
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 mr-3 animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2 animate-pulse" />
                            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-48 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    filteredCourses.map(([code, group]) => {
                      const isSelected = selected.includes(code);
                      return (
                        <div
                          key={code}
                          onClick={() => toggleCourse(code)}
                          className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${
                            isSelected 
                              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" 
                              : "bg-white dark:bg-slate-800 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-200 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${
                            isSelected ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                          
                          <div>
                            <div className={`text-sm font-bold ${isSelected ? "text-indigo-900 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300"}`}>{code}</div>
                            <div className="text-xs text-slate-400 truncate w-48">{group.name}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {activeTab === 'cart' && (
                <>
                  {selected.length === 0 ? (
                    <div className="text-center text-slate-400 dark:text-slate-500 mt-10 text-sm">No courses selected yet.</div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button 
                          onClick={handleClearAll}
                          className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded border border-transparent hover:border-red-100 dark:hover:border-red-900 transition-all flex items-center gap-1"
                        >
                          <span>🗑️</span> Remove All
                        </button>
                      </div>

                      {selected.map((code) => (
                        <div key={code} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-3 mb-2 group transition-all hover:shadow-md">
                          
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                                {code}
                                {pinnedSections[code] && (
                                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 flex items-center gap-1" title="Section Locked">
                                    🔒 <span className="font-bold">{courses[code]?.sections.find((s:any) => s.crn === pinnedSections[code])?.section}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate w-48">{courses[code]?.name}</div>
                            </div>
                            <button 
                              onClick={() => toggleCourse(code)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                              title="Remove Course"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="mb-1">
                            <button
                              onClick={() => toggleAllowConflict(code)}
                              className={`
                                w-full flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer
                                ${allowConflict[code]
                                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                  : "bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 hover:border-amber-200 dark:hover:border-amber-800"
                                }
                              `}
                              title="Allow this course to overlap with specific other lectures (e.g. when the instructor allows conflicts)"
                            >
                              <span className={`text-[10px] font-bold ${allowConflict[code] ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>
                                ⚔️ Allow Conflicts
                              </span>
                              <span className={`relative w-8 h-4 flex items-center rounded-full transition-colors duration-300 ${allowConflict[code] ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                                <span className={`absolute w-3 h-3 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-out ${allowConflict[code] ? "translate-x-4" : "translate-x-0.5"}`} />
                              </span>
                            </button>

                            {allowConflict[code] && (
                              <div className="mt-1 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-900/10">
                                <div className="text-[9px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1.5">
                                  May conflict with:
                                </div>

                                {selected.filter(other => other !== code).length === 0 ? (
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    Add another course to pick conflict targets.
                                  </div>
                                ) : (
                                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                                    {selected.filter(other => other !== code).map(other => {
                                      const isTarget = allowConflict[code]?.includes(other);
                                      return (
                                        <label
                                          key={other}
                                          className={`
                                            flex items-center justify-between gap-2 p-1.5 rounded-md border cursor-pointer transition-all
                                            ${isTarget
                                              ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700"
                                              : "bg-white dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 hover:border-amber-200 dark:hover:border-amber-800"
                                            }
                                          `}
                                        >
                                          <span className="flex flex-col min-w-0">
                                            <span className={`text-[11px] font-bold truncate ${isTarget ? "text-amber-900 dark:text-amber-200" : "text-slate-700 dark:text-slate-300"}`}>
                                              {other}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                              {courses[other]?.name}
                                            </span>
                                          </span>
                                          <input
                                            type="checkbox"
                                            checked={!!isTarget}
                                            onChange={() => toggleConflictTarget(code, other)}
                                            className="accent-amber-500 w-3.5 h-3.5 shrink-0 cursor-pointer"
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}

                                {(allowConflict[code]?.length ?? 0) === 0 && selected.filter(other => other !== code).length > 0 && (
                                  <div className="mt-1.5 text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                                    No classes selected — conflicts stay blocked.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {courses[code]?.sections && (
                            <details className="group/accordion mt-1">
                              <summary className="list-none cursor-pointer text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center justify-between select-none p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800">
                                <span>
                                  {pinnedSections[code] 
                                    ? "✨ Change Section" 
                                    : "⚙️ Pin Section (Optional)"}
                                </span>
                                <span className="transform group-open/accordion:rotate-180 transition-transform text-[10px]">▼</span>
                              </summary>
                              
                              <div className="mt-2 grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1 pt-1 custom-scrollbar">
                                {courses[code].sections.map((section: any) => {
                                  const isPinned = pinnedSections[code] === section.crn;
                                  const instructorName = section.schedule?.[0]?.instructor || "Staff";
                                  
                                  return (
                                    <button
                                      key={section.crn}
                                      onClick={() => togglePin(code, section.crn)}
                                      className={`
                                        relative flex flex-col items-start p-2 rounded-md border transition-all text-left group/btn
                                        ${isPinned 
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-1 ring-indigo-400' 
                                          : 'bg-white dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm'
                                        }
                                      `}
                                    >
                                      <div className="flex justify-between items-center w-full mb-1">
                                        <span className={`font-bold text-sm ${isPinned ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                          Sec {section.section}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPinned ? 'bg-indigo-500 text-indigo-100' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                                          {section.crn}
                                        </span>
                                      </div>

                                      <div className={`text-xs flex items-center gap-1 w-full truncate ${isPinned ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                        <span className="opacity-70">👨‍🏫</span> 
                                        <span className="truncate" title={instructorName}>
                                          {instructorName}
                                        </span>
                                      </div>

                                      {isPinned && (
                                        <div className="absolute -top-1 -right-1 bg-white text-indigo-600 rounded-full p-0.5 shadow-sm border border-indigo-200">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
              {activeTab === 'constraints' && (
  <>
    <div className="text-slate-700 dark:text-slate-300 font-medium mb-4 flex items-center gap-2">
      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
      Filter Preferences
    </div>
    
    <div className="flex flex-col gap-4">
      

      <div 
        className={`
          flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative overflow-hidden
          ${constraints["no840"] 
            ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 shadow-sm" 
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-slate-600"
          }
        `}
      >
        <div className="flex items-center gap-3 z-10">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0
            ${constraints["no840"]
              ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300" 
              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
            }
          `}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className={`text-sm font-bold transition-colors ${constraints["no840"] ? "text-rose-900 dark:text-rose-100" : "text-slate-700 dark:text-slate-300"}`}>
              Exclude 8:40 Classes
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              I want to <strong className={constraints["no840"] ? "text-rose-600 dark:text-rose-300" : ""}>sleep in</strong>. No early starts.
            </span>
          </div>
        </div>

        <div 
          onClick={() => toggleBoolean('no840')} 
          className={`
            relative w-11 h-6 flex items-center rounded-full cursor-pointer transition-colors duration-300 z-10 shrink-0 ml-2
            ${constraints["no840"] ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}
          `}
        >
          <div className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-out ${constraints["no840"] ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </div>


      <div 
        className={`
          flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative overflow-hidden
          ${constraints.compact 
            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm" 
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-100 dark:hover:border-slate-600"
          }
        `}
      >
        {constraints.compact && (
          <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-indigo-400/10 rounded-full blur-xl pointer-events-none"></div>
        )}

        <div className="flex items-center gap-3 z-10 overflow-hidden">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0
            ${constraints.compact 
              ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" 
              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
            }
          `}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold transition-colors ${constraints.compact ? "text-indigo-900 dark:text-indigo-100" : "text-slate-700 dark:text-slate-300"}`}>
                Minimize Gaps
              </span>
              <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 tracking-wide shrink-0">
                NEW
              </span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Prioritizes schedules with the <strong className={constraints.compact ? "text-indigo-600 dark:text-indigo-300" : ""}>least waiting time</strong> between classes.
            </span>
          </div>
        </div>
        
        <div 
          onClick={() => toggleBoolean('compact')} 
          className={`
            relative w-11 h-6 flex items-center rounded-full cursor-pointer transition-colors duration-300 z-10 shrink-0 ml-2
            ${constraints.compact ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}
          `}
        >
          <div className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-out ${constraints.compact ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </div>


      <div className={`
        rounded-xl border transition-all duration-300 overflow-hidden
        ${dayOffsOpen 
          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" 
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-600"
        }
      `}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0
              ${dayOffsOpen 
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" 
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
              }
            `}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <div className="flex flex-col">
              <span className={`text-sm font-bold transition-colors ${dayOffsOpen ? "text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-slate-300"}`}>
                Specific Days Off
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                Block specific days to have <strong className={dayOffsOpen ? "text-emerald-600 dark:text-emerald-300" : ""}>free time</strong>.
              </span>
            </div>
          </div>

          <div 
            onClick={() => setDayOffsOpen(prev => !prev)} 
            className={`
              relative w-11 h-6 flex items-center rounded-full cursor-pointer transition-colors duration-300 shrink-0 ml-2
              ${dayOffsOpen ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}
            `}
          >
            <div className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-out ${dayOffsOpen ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </div>

        <div className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${dayOffsOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}
        `}>
          <div className="p-3 pt-0 flex flex-wrap gap-2">
            {Object.entries(DAYS_map).map(([day, val]) => {
              const isChosen = constraints.day_offs.includes(val);
              return (
                <button 
                  key={day}
                  onClick={() => toggleArray("day_offs", Number(val))} 
                  className={`
                    flex items-center px-3 py-1.5 text-xs font-bold rounded-lg transition-all border shadow-sm
                    ${isChosen 
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-200 dark:shadow-none" 
                      : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-emerald-300 hover:text-emerald-600"
                    }
                  `}
                >
                  {day}
                  {isChosen && <span className="ml-1.5">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>


      <div 
        className={`
          flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative overflow-hidden
          ${constraints.lunchBreak 
            ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 shadow-sm" 
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-slate-600"
          }
        `}
      >
        <div className="flex items-center gap-3 z-10">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0
            ${constraints.lunchBreak
              ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300" 
              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
            }
          `}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8a4 4 0 014-4h8a4 4 0 014 4v1H4V8zm0 5h16v2H4v-2zm0 5h16v1a3 3 0 01-3 3H7a3 3 0 01-3-3v-1z" />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold transition-colors ${constraints.lunchBreak ? "text-orange-900 dark:text-orange-100" : "text-slate-700 dark:text-slate-300"}`}>
                Lunch Break
              </span>              
              <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 tracking-wide shrink-0">
                NEW
              </span>
            </div>
            
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Keep <strong className={constraints.lunchBreak ? "text-orange-600 dark:text-orange-300" : ""}>12:40 - 13:30</strong> empty for food.
            </span>
          </div>
        </div>

        <div 
          onClick={() => toggleBoolean('lunchBreak')} 
          className={`
            relative w-11 h-6 flex items-center rounded-full cursor-pointer transition-colors duration-300 z-10 shrink-0 ml-2
            ${constraints.lunchBreak ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'}
          `}
        >
          <div className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-out ${constraints.lunchBreak ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </div>

    </div>
  </>
)}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              
              <button
                onClick={generateSchedule}
                disabled={loading || selected.length === 0}
                className={`w-full py-3 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 ${
                  loading || selected.length === 0
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                    : "bg-indigo-600 dark:bg-indigo-500 cursor-pointer text-white hover:bg-indigo-700 dark:hover:bg-indigo-400 hover:shadow-lg"
                }`}
              >
                {loading ? "Calculating..." : "Generate Schedule"}
              </button>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <a 
                href="https://github.com/henesduran/suplanner" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current transition-transform group-hover:scale-110">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Developed by</span>
                  <span className="text-xs font-bold leading-none">Hüseyin Enes Duran</span>
                </div>
              </a>
            </div>
          </div>


      <div className="flex-1 flex flex-col p-3 h-full relative">
        
        {schedules.length > 0 && (
          <div className="flex flex-col space-y-3 mb-2">
            
            <div className="flex justify-between items-center">
               
               <div className="flex items-center gap-4">
                  <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                      Option <span className="text-indigo-600 dark:text-indigo-400 text-xl">{currentIndex + 1}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal text-sm ml-1">/ {schedules.length}</span>
                  </h2>

                  
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer text-indigo-700 dark:text-indigo-300 rounded-md transition-all text-xs font-bold border border-indigo-100 dark:border-indigo-800 group"
                    title="Download Schedule"
                  >
                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    <span>Download Schedule As Image</span>
                  </button>
                  <button 
                    disabled={copied}
                    onClick={handleCopyAllCRNs}
                    className={`
                        flex items-center gap-1 px-3 py-1.5 rounded-md transition-all text-xs font-bold border group
                        ${copied 
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 cursor-default"
                          : "bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800 cursor-pointer" 
                        }
                      `}
                      title="Copy Course List with CRNs"
                  >
                    {copied ? (
                    <>
                      <svg className="w-4 h-4 transition-transform scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                      </svg>
                      <span>Copy All CRNs</span>
                    </>
                  )}
                  </button>
               </div>
               
               <div className="flex space-x-1">
                 <button 
                   disabled={currentIndex === 0}
                   onClick={() => setCurrentIndex(i => i - 1)}
                   className="py-0.5 px-3 transition-all bg-white dark:bg-slate-800 border dark:border-slate-700 not-disabled:cursor-pointer rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30"
                 >
                   ←
                 </button>
                 <button 
                   disabled={currentIndex === schedules.length - 1}
                   onClick={() => setCurrentIndex(i => i + 1)}
                   className="py-0.5 px-3 transition-all bg-white dark:bg-slate-800 border dark:border-slate-700 not-disabled:cursor-pointer rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30"
                 >
                   →
                 </button>
               </div>
            </div>

            
            <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent space-x-2">
              {(() => {
                const jumps = [];
                if (schedules.length > 0) jumps.push(1);
                
                for (let i = 5; i < schedules.length; i += 5) {
                  jumps.push(i);
                }
                
                if (schedules.length > 1 && !jumps.includes(schedules.length)) {
                  jumps.push(schedules.length);
                }
                
        
                jumps.sort((a, b) => a - b);

                return jumps.map((num) => {

                  const isExact = (currentIndex + 1) === num;

                  return (
                    <button
                      key={num}
                      onClick={() => setCurrentIndex(num - 1)}
                      className={`
                        shrink-0 px-3 py-1.5 text-xs font-bold rounded-md border transition-all
                        ${isExact 
                          ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-md scale-105" 
                          : "bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                        }
                      `}
                    >
                      {num}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <div ref={gridRef} className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
          {schedules.length > 0 ? (
        <Coursegrid sections={schedules[currentIndex]} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-6 text-center">
          {hasSearched ? (
            <>
              <div className="text-4xl mb-3">😕</div>
              <h3 className="font-bold text-slate-600 dark:text-slate-300 text-lg">No Schedule Found</h3>
              <p className="text-sm mt-1 max-w-xs">
                The selected courses, pinned sections or filters (e.g., 8:40 restriction) conflict with each other. Please relax constraints and try again.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3 animate-bounce">📅</div>
              <p className="font-medium text-slate-600 dark:text-slate-300">Ready to plan?</p>
              <p className="text-sm mt-1 mb-4 max-w-50">Select your courses from the left and press Generate.</p>

              <button 
                onClick={() => setShowHelp(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <span>How to use?</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>

              <div className="absolute bottom-6 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm shadow-sm transition-all hover:bg-slate-100 dark:hover:bg-slate-800 cursor-default">
  
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>

                <div className="flex flex-col items-start leading-none">
                  
                  <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    This is an open-source student project, not an official Sabancı University tool.
                  </span>
                  
                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                    Course schedules are subject to change. Please verify all CRNs via Bannerweb before registration.
                  </span>
                  
                </div>
              </div>
            </>
          )}
      
        </div>
      )}
        </div>

      </div>

      {showHelp && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
            <button onClick={handleCloseHelp} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl">🎓</div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Create your schedule in 3 steps.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4 group">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">1</div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Add Courses</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Search for courses (e.g. MATH 101) in the left panel and click to select.</p>
                  </div>
                </div>

                <div className="flex gap-4 group">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">2</div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Filter (Optional)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Use the "Filters" tab to block 8:40 classes or specific days.</p>
                  </div>
                </div>

                <div className="flex gap-4 group">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 font-bold text-slate-500 text-sm">3</div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Generate & Export</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Click "Generate Schedule". Swipe through options and download the image.</p>
                  </div>
                </div>
              </div>

              <button onClick={handleCloseHelp} className="w-full mt-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                Got it, let's start!
              </button>
            </div>
          </div>
        </div>
      )}

      {!mobileWarningClosed && (
        <div className="md:hidden fixed inset-0 z-100 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="text-4xl">🖥️</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            For a Better Experience
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-xs">
            This application contains complex tables and is difficult to use on mobile screens.
            <br/><br/>
            <span className="text-indigo-400 font-bold">Please enable "Request Desktop Site" in your browser settings.</span>
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-800/50 p-2 rounded border border-slate-700">
              <span>Settings ({isIOS ? 'Aa' : '⋮'})</span>
              <span>→</span>
              <span>Desktop Website</span>
            </div>

            <button
              onClick={() => {
                setMobileWarningClosed(true);
                if (typeof window !== 'undefined') localStorage.setItem('mobileWarningClosed', 'true');
              }}
              className="w-full py-3 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-100 transition-colors active:scale-95"
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}
        </div>
      </div>

    </div>
    
  );
  
}

export default App;
