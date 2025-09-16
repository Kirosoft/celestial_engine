import React, { useEffect, useState } from 'react';

interface FsEntry { name: string; kind: 'file'|'dir'; size?: number; modifiedMs?: number }
interface Listing { path: string; entries: FsEntry[]; parent: string | null }

export interface FileExplorerProps {
  mode: 'file' | 'directory';
  initialPath?: string; // relative inside repo
  onSelect: (relPath: string) => void;
  onCancel?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ mode, initialPath = '', onSelect, onCancel }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(path: string){
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/fs?path=${encodeURIComponent(path)}`);
      const j = await r.json();
      if(!r.ok){ setError(j?.error?.code || 'error'); setListing(null); } else setListing(j as Listing);
    } catch(e:any){ setError(e?.message || 'fetch_failed'); setListing(null); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(currentPath); }, [currentPath]);

  function enterDir(name: string){
    const next = listing?.path ? `${listing.path}/${name}` : name;
    setCurrentPath(next);
  }
  function goParent(){ if(listing && listing.parent !== null) setCurrentPath(listing.parent || ''); }

  function chooseFile(name: string){
    if(mode === 'file'){
      const rel = listing?.path ? `${listing.path}/${name}` : name;
      onSelect(rel);
    } else {
      // In directory mode clicking a file does nothing
    }
  }
  function chooseDirectory(){
    // selecting the current directory path
    onSelect(listing?.path || '');
  }

  return (
    <div style={{ fontFamily: 'sans-serif', width: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong style={{ flex: 1 }}>Repository Browser</strong>
        {onCancel && <button onClick={onCancel}>Close</button>}
      </div>
      <div style={{ marginBottom: 6, fontSize: 12, color: '#555' }}>Path: /{listing?.path || ''}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button onClick={goParent} disabled={!listing || listing.parent === null}>Up</button>
        {mode === 'directory' && <button onClick={chooseDirectory} disabled={!listing}>Select This Directory</button>}
      </div>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      <div style={{ border: '1px solid #ccc', maxHeight: 300, overflow: 'auto', padding: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
          {listing?.entries.map(e => (
            <tr key={e.name}
                style={{ cursor: 'pointer' }}
                onClick={() => e.kind === 'dir' ? enterDir(e.name) : chooseFile(e.name)}>
              <td style={{ padding: '2px 4px', width: 24 }}>{e.kind === 'dir' ? '📁' : '📄'}</td>
              <td style={{ padding: '2px 4px' }}>{e.name}</td>
              <td style={{ padding: '2px 4px', textAlign: 'right', fontSize: 11, color: '#777' }}>
                {e.kind === 'file' ? e.size : ''}
              </td>
            </tr>
          ))}
          {(!listing || listing.entries.length === 0) && !loading && !error && (
            <tr><td colSpan={3} style={{ padding: 8, textAlign: 'center', fontSize: 12 }}>Empty</td></tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
