import React, { useState } from 'react';
import { FileExplorer } from '../FileExplorer';

interface FileReaderNodeInspectorProps {
  node: any;
  onChange: (patch: any) => void; // patch props
}

// Minimal integration: allows switching mode and selecting file/dir via FileExplorer popup
export const FileReaderNodeInspector: React.FC<FileReaderNodeInspectorProps> = ({ node, onChange }) => {
  const props = node.props || {};
  const [showBrowser, setShowBrowser] = useState(false);

  function setProp(k: string, v: any){
    onChange({ ...props, [k]: v });
  }

  function handleSelect(relPath: string){
    if(props.mode === 'directory') setProp('dirPath', relPath);
    else setProp('filePath', relPath);
    setShowBrowser(false);
  }

  function toggleMode(){
    const next = props.mode === 'directory' ? 'single' : 'directory';
    const cleaned: any = { ...props, mode: next };
    if(next === 'directory') delete cleaned.filePath; else delete cleaned.dirPath; // mutually exclusive
    onChange(cleaned);
  }

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>FileReaderNode</strong>
        <button onClick={toggleMode} style={{ marginLeft: 'auto' }}>Mode: {props.mode || 'single'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {props.mode === 'single' && (
          <div>
            <div style={{ marginBottom: 4 }}>File: <code>{props.filePath || '-'}</code></div>
            <button onClick={()=> setShowBrowser(true)}>Select File...</button>
          </div>
        )}
        {props.mode === 'directory' && (
          <div>
            <div style={{ marginBottom: 4 }}>Directory: <code>{props.dirPath || '-'}</code></div>
            <button onClick={()=> setShowBrowser(true)}>Select Directory...</button>
            <div style={{ marginTop: 4 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                Include Patterns (comma):
                <input value={props.includePatterns || ''} onChange={e=> setProp('includePatterns', e.target.value)} placeholder="*.txt,*.md" />
              </label>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={!!props.emitContent} onChange={e=> setProp('emitContent', e.target.checked)} /> Emit Content
        </label>
        {props.emitContent && (
          <select value={props.encodedAs || 'text'} onChange={e=> setProp('encodedAs', e.target.value)}>
            <option value="text">text</option>
            <option value="base64">base64</option>
          </select>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {props.mode === 'directory' && <button onClick={()=> setProp('action', 'scan')}>Scan</button>}
        {props.mode === 'directory' && <button onClick={()=> setProp('action', 'reset')}>Reset</button>}
  <button data-testid="filereader-send-next" onClick={()=> setProp('action', 'sendNext')}>Send/Next</button>
      </div>
      {props.mode === 'directory' && props.scannedFiles && (
        <div style={{ maxHeight: 90, overflow: 'auto', border: '1px solid #ccc', padding: 4 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Scanned Files</div>
          {props.scannedFiles.length === 0 && <div style={{ fontSize: 11, color: '#666' }}>None</div>}
          {props.scannedFiles.map((f:string, i:number)=> (
            <div key={i} style={{ fontSize: 11, background: i === props.cursorIndex ? '#eef' : undefined }}>{f}</div>
          ))}
        </div>
      )}
      {showBrowser && (
        <div style={{ position: 'absolute', top: 40, left: 40, background: '#fff', border: '1px solid #999', padding: 8, zIndex: 1000 }}>
          <FileExplorer mode={props.mode === 'directory' ? 'directory' : 'file'} onSelect={handleSelect} onCancel={()=> setShowBrowser(false)} />
        </div>
      )}
    </div>
  );
};
