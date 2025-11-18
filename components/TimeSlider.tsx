import React from 'react';

const TimeSlider = () => {
  return (
    <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-4 flex items-center gap-6">
      <div className="flex flex-col items-center min-w-[100px] border-r border-slate-100 pr-6">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Time</span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black font-mono tabular-nums text-slate-900 tracking-tight">12:00</span>
          <span className="text-xs font-bold text-slate-400">PM</span>
        </div>
      </div>
      <div className="flex-1 relative pt-4 pb-2">
        <div className="absolute top-0 left-0 w-full h-1.5 flex rounded-full overflow-hidden bg-slate-100">
          <div className="absolute h-full bg-slate-200" style={{ left: '0%', width: '30%' }}></div>
          <div className="absolute h-full bg-slate-200" style={{ left: '30%', width: '20%' }}></div>
          <div className="absolute h-full bg-slate-200" style={{ left: '50%', width: '50%' }}></div>
        </div>
        <div className="absolute -top-5 left-0 w-full h-full pointer-events-none">
          <div className="absolute text-center" style={{ left: '0%', width: '30%' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap px-1">Weekday Lunch</span>
          </div>
          <div className="absolute text-center" style={{ left: '30%', width: '20%' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap px-1">Happy Hour</span>
          </div>
          <div className="absolute text-center" style={{ left: '50%', width: '50%' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap px-1">Dinner Service</span>
          </div>
        </div>
        <div className="relative flex w-full touch-none select-none items-center h-6">
          <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 transition-all duration-75 ease-out" style={{ width: '0%' }}></div>
          </div>
          <input
            min="720"
            max="1320"
            step="15"
            className="absolute w-full h-full opacity-0 cursor-pointer z-20"
            type="range"
            value="720"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 w-6 bg-slate-900 rounded-full shadow-xl border-2 border-white z-10 pointer-events-none transition-all duration-75 ease-out flex items-center justify-center"
            style={{ left: '0%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
              12:00 PM
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45"></div>
            </div>
          </div>
        </div>
        <div className="relative flex justify-between mt-2 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
          <span className="absolute transform -translate-x-1/2" style={{ left: '0%' }}>12 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '10%' }}>1 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '20%' }}>2 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '30%' }}>3 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '40%' }}>4 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '50%' }}>5 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '60%' }}>6 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '70%' }}>7 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '80%' }}>8 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '90%' }}>9 PM</span>
          <span className="absolute transform -translate-x-1/2" style={{ left: '100%' }}>10 PM</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;
