import React from 'react';
import { Icons } from './Icons';
import { TextStyle, TextAlign, FontFamily, FontSize } from '../types';

interface TextToolbarProps {
  style: TextStyle;
  onChange: (newStyle: TextStyle) => void;
}

const TextToolbar: React.FC<TextToolbarProps> = ({ style, onChange }) => {
  const updateStyle = <K extends keyof TextStyle>(key: K, value: TextStyle[K]) => {
    onChange({ ...style, [key]: value });
  };

  const btnClass = (active: boolean) => 
    `p-1.5 rounded-md transition-colors ${active ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm w-full">
      {/* Alignment */}
      <div className="flex border-r pr-2 gap-1 border-gray-200">
        <button onClick={() => updateStyle('align', 'left')} className={btnClass(style.align === 'left')} title="Align Left">
          <Icons.Left size={16} />
        </button>
        <button onClick={() => updateStyle('align', 'center')} className={btnClass(style.align === 'center')} title="Align Center">
          <Icons.Center size={16} />
        </button>
        <button onClick={() => updateStyle('align', 'right')} className={btnClass(style.align === 'right')} title="Align Right">
          <Icons.Right size={16} />
        </button>
      </div>

      {/* Formatting */}
      <div className="flex border-r pr-2 gap-1 border-gray-200">
        <button onClick={() => updateStyle('bold', !style.bold)} className={btnClass(style.bold)} title="Bold">
          <Icons.Bold size={16} />
        </button>
        <button onClick={() => updateStyle('italic', !style.italic)} className={btnClass(style.italic)} title="Italic">
          <Icons.Italic size={16} />
        </button>
      </div>

      {/* Font Family */}
      <div className="flex border-r pr-2 gap-1 border-gray-200 flex-grow sm:flex-grow-0">
        <select 
          value={style.family}
          onChange={(e) => updateStyle('family', e.target.value as FontFamily)}
          className="w-full sm:w-auto text-xs border-none outline-none bg-transparent font-medium text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1"
        >
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="flex gap-1 items-center flex-grow sm:flex-grow-0">
        <span className="text-[10px] uppercase text-gray-400 font-bold hidden xs:inline">Size</span>
        <select 
          value={style.size}
          onChange={(e) => updateStyle('size', e.target.value as FontSize)}
          className="w-full sm:w-auto text-xs border-none outline-none bg-transparent font-medium text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1"
        >
          <option value="sm">Small</option>
          <option value="base">Normal</option>
          <option value="lg">Large</option>
          <option value="xl">XL</option>
          <option value="2xl">Title</option>
          <option value="4xl">Display</option>
        </select>
      </div>
      
       {/* Color Picker (Simple) */}
       <div className="ml-auto flex items-center gap-1">
          <input 
            type="color" 
            value={style.color}
            onChange={(e) => updateStyle('color', e.target.value)}
            className="w-6 h-6 rounded overflow-hidden border-0 p-0 cursor-pointer"
            title="Text Color"
          />
       </div>
    </div>
  );
};

export default TextToolbar;