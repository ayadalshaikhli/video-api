import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

interface DebugSolidProps { color?: string; label?: string; }
export const DebugSolid = ({color='#101820', label='DebugSolid'}: DebugSolidProps) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: color, justifyContent:'center', alignItems:'center', color:'#0f0', fontFamily:'monospace', fontSize:60}}>
      <div>{label}</div>
      <div style={{fontSize:28, marginTop:20}}>Frame {f}</div>
    </AbsoluteFill>
  );
};
