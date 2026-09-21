import React from 'react';

interface AngleDiagramProps {
  angleId: string;
  className?: string;
}

export const AngleDiagram: React.FC<AngleDiagramProps> = ({ angleId, className = 'w-full h-full' }) => {
  // Common visual styles
  const gridStroke = 'rgba(255, 255, 255, 0.07)';
  const subjectFill = '#94a3b8'; // slate-400
  const subjectAccent = '#cbd5e1'; // slate-300
  const cameraFill = '#f59e0b'; // amber-500
  const fovFill = 'rgba(245, 158, 11, 0.18)';
  const fovStroke = 'rgba(245, 158, 11, 0.5)';
  const textMuted = '#64748b'; // slate-500
  const textBright = '#f8fafc'; // slate-50

  const renderContent = () => {
    switch (angleId) {
      // ── Worm's-Eye / Floor POV ──
      case 'worms_eye':
      case 'floor_level_upward':
        return (
          <>
            {/* Ground line */}
            <line x1="20" y1="170" x2="280" y2="170" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
            <text x="30" y="185" fill={textMuted} fontSize="9" fontFamily="monospace">FLOOR LEVEL (0m)</text>
            
            {/* Towering Subject */}
            <circle cx="150" cy="45" r="14" fill={subjectAccent} />
            <path d="M 130 70 L 170 70 L 180 170 L 120 170 Z" fill={subjectFill} opacity="0.85" />
            
            {/* Camera on ground pointing steeply UP (+75°) */}
            <path d="M 50 165 L 140 35 L 175 45 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            {/* Camera body on floor */}
            <rect x="35" y="152" width="22" height="15" rx="3" fill={cameraFill} />
            <circle cx="46" cy="159" r="4" fill="#1e293b" />
            {/* Angled lens pointing up */}
            <polygon points="56,154 66,146 64,162 56,160" fill={cameraFill} />
            
            {/* Angle Indicator Arc */}
            <path d="M 68 160 A 20 20 0 0 0 64 142" fill="none" stroke={cameraFill} strokeWidth="1.5" />
            <text x="75" y="148" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">+75° UP</text>
            <text x="210" y="30" fill={textBright} fontSize="10" fontWeight="bold">EXTREME LOW</text>
            <text x="210" y="44" fill={textMuted} fontSize="8" fontFamily="monospace">Lens on ground</text>
          </>
        );

      // ── Low Angle ──
      case 'low_angle':
      case 'slight_low':
        return (
          <>
            <line x1="20" y1="170" x2="280" y2="170" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
            
            {/* Subject standing */}
            <circle cx="190" cy="55" r="13" fill={subjectAccent} />
            <path d="M 175 75 L 205 75 L 210 170 L 170 170 Z" fill={subjectFill} opacity="0.85" />
            
            {/* Camera at knee/waist level pointing UP (+35°) */}
            <path d="M 65 130 L 180 40 L 215 110 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <rect x="42" y="125" width="22" height="15" rx="3" fill={cameraFill} />
            <circle cx="53" cy="132" r="4" fill="#1e293b" />
            <polygon points="63,127 74,122 72,137 63,135" fill={cameraFill} />
            
            {/* Tripod legs */}
            <line x1="45" y1="140" x2="35" y2="170" stroke={cameraFill} strokeWidth="1.5" />
            <line x1="60" y1="140" x2="70" y2="170" stroke={cameraFill} strokeWidth="1.5" />
            
            <text x="78" y="118" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">+30° PITCH</text>
            <text x="25" y="35" fill={textBright} fontSize="10" fontWeight="bold">LOW ANGLE</text>
            <text x="25" y="48" fill={textMuted} fontSize="8" fontFamily="monospace">Elongates posture</text>
          </>
        );

      // ── Overhead / Bird's-Eye ──
      case 'overhead':
      case 'birds_eye':
      case 'ceiling_pov':
        return (
          <>
            {/* Ceiling rail */}
            <line x1="20" y1="30" x2="280" y2="30" stroke="#475569" strokeWidth="2" />
            <text x="30" y="24" fill={textMuted} fontSize="8" fontFamily="monospace">CEILING MOUNT (90°)</text>
            
            {/* Camera pointing straight down */}
            <rect x="138" y="30" width="24" height="16" rx="3" fill={cameraFill} />
            <polygon points="144,46 156,46 160,56 140,56" fill={cameraFill} />
            
            {/* Downward FOV cone */}
            <path d="M 142 56 L 60 170 L 240 170 L 158 56 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            {/* Top-down view of subject (head & shoulders circle) */}
            <ellipse cx="150" cy="140" rx="32" ry="16" fill={subjectFill} />
            <circle cx="150" cy="138" r="14" fill={subjectAccent} />
            
            <text x="165" y="80" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">-90° TOP-DOWN</text>
            <text x="20" y="145" fill={textBright} fontSize="10" fontWeight="bold">OVERHEAD</text>
            <text x="20" y="158" fill={textMuted} fontSize="8" fontFamily="monospace">Planimetric bird's-eye</text>
          </>
        );

      // ── Overhead Lying on Bed (Boudoir) ──
      case 'overhead_lying':
      case 'under_sheets':
        return (
          <>
            {/* Bed Mattress outline (top-down) */}
            <rect x="60" y="40" width="180" height="130" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            {/* Pillow */}
            <rect x="75" y="50" width="60" height="24" rx="4" fill="#334155" />
            <rect x="165" y="50" width="60" height="24" rx="4" fill="#334155" />
            {/* Sheets fold */}
            <path d="M 60 110 Q 150 95 240 110 L 240 170 L 60 170 Z" fill="#334155" opacity="0.6" />
            
            {/* Lying figure (head on pillow, body down) */}
            <circle cx="150" cy="62" r="12" fill={subjectAccent} />
            <ellipse cx="150" cy="95" rx="16" ry="24" fill={subjectFill} />
            
            {/* Camera centered directly above pointing down */}
            <circle cx="150" cy="105" r="38" fill="none" stroke={cameraFill} strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="150" cy="105" r="4" fill={cameraFill} />
            <line x1="150" y1="85" x2="150" y2="125" stroke={cameraFill} strokeWidth="1" />
            <line x1="130" y1="105" x2="170" y2="105" stroke={cameraFill} strokeWidth="1" />
            
            <text x="15" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">BED TOP-DOWN</text>
            <text x="15" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Lying on sheets</text>
          </>
        );

      // ── Foot of Bed ──
      case 'foot_of_bed':
        return (
          <>
            {/* Bed perspective tapering to headboard */}
            <polygon points="90,60 210,60 260,165 40,165" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            {/* Headboard */}
            <rect x="80" y="45" width="140" height="15" rx="3" fill="#475569" />
            
            {/* Subject lying head near headboard */}
            <circle cx="150" cy="75" r="10" fill={subjectAccent} />
            <ellipse cx="150" cy="115" rx="18" ry="30" fill={subjectFill} opacity="0.8" />
            
            {/* Camera at footboard pointing forward */}
            <rect x="138" y="160" width="24" height="15" rx="3" fill={cameraFill} />
            <polygon points="144,160 156,160 159,150 141,150" fill={cameraFill} />
            
            {/* View cone looking along mattress */}
            <path d="M 150 150 L 100 65 L 200 65 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="15" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">FOOT OF BED POV</text>
            <text x="15" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Lengthwise view to head</text>
          </>
        );

      // ── Head of Bed ──
      case 'head_of_bed':
        return (
          <>
            {/* Bed perspective tapering away */}
            <polygon points="40,55 260,55 210,160 90,160" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
            {/* Pillows at top */}
            <rect x="80" y="60" width="140" height="20" rx="4" fill="#334155" />
            
            {/* Camera above headboard looking DOWN body */}
            <rect x="138" y="25" width="24" height="15" rx="3" fill={cameraFill} />
            <polygon points="144,40 156,40 159,50 141,50" fill={cameraFill} />
            <path d="M 150 50 L 80 155 L 220 155 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            {/* Subject head near camera */}
            <circle cx="150" cy="75" r="14" fill={subjectAccent} />
            <ellipse cx="150" cy="115" rx="18" ry="30" fill={subjectFill} />
            
            <text x="15" y="20" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">HEAD OF BED</text>
            <text x="15" y="33" fill={textMuted} fontSize="8" fontFamily="monospace">Looking down toward feet</text>
          </>
        );

      // ── Bedside Eye Level ──
      case 'bedside_eye_level':
        return (
          <>
            {/* Horizontal mattress profile */}
            <rect x="70" y="110" width="200" height="25" rx="4" fill="#334155" />
            <rect x="230" y="85" width="35" height="25" rx="3" fill="#475569" />
            
            {/* Subject lying flat on mattress */}
            <circle cx="235" cy="100" r="10" fill={subjectAccent} />
            <path d="M 100 110 Q 150 95 225 105 L 225 112 L 100 112 Z" fill={subjectFill} />
            
            {/* Camera level with mattress looking across */}
            <rect x="20" y="103" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="42,106 52,102 52,118 42,114" fill={cameraFill} />
            
            <path d="M 52 110 L 250 85 L 250 125 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="20" y="30" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">BEDSIDE EYE-LEVEL</text>
            <text x="20" y="43" fill={textMuted} fontSize="8" fontFamily="monospace">Horizontal mattress plane</text>
          </>
        );

      // ── Mirror Selfie ──
      case 'mirror_selfie':
        return (
          <>
            {/* Mirror Frame (Dotted Reflection Glass) */}
            <rect x="130" y="35" width="140" height="135" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <text x="138" y="52" fill="#38bdf8" fontSize="8" fontFamily="monospace">MIRROR GLASS 🪞</text>
            
            {/* Reflection of Person holding phone inside mirror */}
            <circle cx="200" cy="80" r="13" fill={subjectAccent} opacity="0.8" />
            <path d="M 180 100 L 220 100 L 225 168 L 175 168 Z" fill={subjectFill} opacity="0.7" />
            
            {/* Phone held in front of chest */}
            <rect x="188" y="98" width="14" height="22" rx="2" fill={cameraFill} />
            <circle cx="195" cy="103" r="2.5" fill="#1e293b" />
            
            {/* Real Person standing in front */}
            <circle cx="65" cy="85" r="14" fill={subjectAccent} />
            <path d="M 45 105 L 85 105 L 90 170 L 40 170 Z" fill={subjectFill} />
            {/* Real phone in hand */}
            <rect x="80" y="102" width="12" height="18" rx="2" fill={cameraFill} />
            
            {/* Reflection ray */}
            <line x1="92" y1="110" x2="130" y2="110" stroke={cameraFill} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="20" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">MIRROR REFLECTION</text>
            <text x="20" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Handheld phone in frame</text>
          </>
        );

      // ── Selfie Front-Camera POV ──
      case 'selfie_pov':
      case 'self_gaze':
        return (
          <>
            {/* Arm extending toward camera in perspective */}
            <polygon points="120,170 180,170 160,110 140,110" fill={subjectFill} opacity="0.5" />
            
            {/* Subject Face close up */}
            <circle cx="150" cy="75" r="28" fill={subjectAccent} />
            <path d="M 110 120 Q 150 110 190 120 L 200 170 L 100 170 Z" fill={subjectFill} />
            
            {/* Smartphone viewport border (Front camera UI) */}
            <rect x="40" y="20" width="220" height="155" rx="16" fill="none" stroke={cameraFill} strokeWidth="2" />
            {/* Camera notch */}
            <rect x="135" y="22" width="30" height="6" rx="3" fill={cameraFill} />
            
            <text x="50" y="165" fill={cameraFill} fontSize="9" fontWeight="bold" fontFamily="monospace">FRONT CAMERA 24mm</text>
            <text x="195" y="38" fill="#ef4444" fontSize="8" fontWeight="bold">● REC</text>
          </>
        );

      // ── Dutch / Canted Angle ──
      case 'dutch_angle':
        return (
          <>
            {/* Tilted Horizon (-45°) */}
            <line x1="20" y1="50" x2="280" y2="150" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
            <text x="180" y="165" fill="#ef4444" fontSize="8" fontFamily="monospace">TILTED HORIZON (45°)</text>
            
            {/* Tilted Camera Frame */}
            <g transform="rotate(25 150 100)">
              <rect x="60" y="30" width="180" height="130" rx="8" fill="none" stroke={cameraFill} strokeWidth="2.5" />
              <circle cx="150" cy="80" r="16" fill={subjectAccent} />
              <path d="M 130 105 L 170 105 L 175 160 L 125 160 Z" fill={subjectFill} />
            </g>
            
            <text x="25" y="30" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">CANTED / DUTCH</text>
            <text x="25" y="43" fill={textMuted} fontSize="8" fontFamily="monospace">Horizon rotated 45°</text>
          </>
        );

      // ── Side Profile (Strict 90°) ──
      case 'full_profile':
        return (
          <>
            <line x1="20" y1="170" x2="280" y2="170" stroke="#475569" strokeWidth="1.5" />
            
            {/* Strict 90 degree facial profile silhouette */}
            <g transform="translate(140, 45)">
              <circle cx="20" cy="20" r="18" fill={subjectAccent} />
              {/* Nose, lips, chin profile cut */}
              <path d="M 20 5 Q 38 18 38 24 L 32 28 L 37 32 L 30 38 L 20 42 Z" fill={subjectAccent} />
              {/* Neck & Torso in profile */}
              <rect x="5" y="42" width="25" height="110" fill={subjectFill} />
            </g>
            
            {/* Camera at strict 90 degree perpendicular */}
            <rect x="35" y="55" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="57,58 67,54 67,70 57,66" fill={cameraFill} />
            
            <path d="M 67 62 L 140 30 L 140 95 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="35" y="40" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">90° PERPENDICULAR</text>
            <text x="35" y="100" fill={textMuted} fontSize="8" fontFamily="monospace">Strict side silhouette</text>
          </>
        );

      // ── Dynamic 3/4 Profile ──
      case 'three_quarter':
        return (
          <>
            {/* 45 degree rotation axis indicator */}
            <ellipse cx="150" cy="155" rx="55" ry="18" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 3" />
            
            {/* Subject turned 45 degrees */}
            <g transform="translate(125, 45)">
              <ellipse cx="25" cy="25" rx="20" ry="24" fill={subjectAccent} />
              <path d="M 8 50 L 45 45 L 50 115 L 5 115 Z" fill={subjectFill} />
              {/* 3/4 Face Guideline */}
              <path d="M 25 5 Q 35 25 25 45" fill="none" stroke="#1e293b" strokeWidth="1.5" />
            </g>
            
            {/* Camera at 45 degree angle */}
            <rect x="45" y="85" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="67,88 77,84 77,100 67,96" fill={cameraFill} />
            
            <path d="M 77 92 L 130 50 L 160 110 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="25" y="30" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">DYNAMIC 3/4 ANGLE</text>
            <text x="25" y="43" fill={textMuted} fontSize="8" fontFamily="monospace">Turned 45° to lens</text>
          </>
        );

      // ── Close-Up Headshot ──
      case 'close_up':
      case 'extreme_close_up':
        return (
          <>
            {/* Viewfinder Reticle Corners */}
            <path d="M 40 45 L 40 30 L 55 30" fill="none" stroke={cameraFill} strokeWidth="2" />
            <path d="M 260 45 L 260 30 L 245 30" fill="none" stroke={cameraFill} strokeWidth="2" />
            <path d="M 40 155 L 40 170 L 55 170" fill="none" stroke={cameraFill} strokeWidth="2" />
            <path d="M 260 155 L 260 170 L 245 170" fill="none" stroke={cameraFill} strokeWidth="2" />
            
            {/* Big Close-up face filling frame */}
            <circle cx="150" cy="85" r="42" fill={subjectAccent} />
            {/* Eyes & focal points */}
            <ellipse cx="135" cy="80" rx="6" ry="3.5" fill="#1e293b" />
            <ellipse cx="165" cy="80" rx="6" ry="3.5" fill="#1e293b" />
            <circle cx="136" cy="79" r="1.5" fill="#ffffff" />
            <circle cx="166" cy="79" r="1.5" fill="#ffffff" />
            
            {/* Focus bracket on eyes */}
            <rect x="120" y="70" width="60" height="20" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 2" />
            
            {/* Shoulders cropped tight */}
            <path d="M 90 140 Q 150 125 210 140 L 210 180 L 90 180 Z" fill={subjectFill} />
            
            <text x="50" y="22" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">85mm PORTRAIT LENS</text>
            <text x="185" y="22" fill="#22c55e" fontSize="9" fontFamily="monospace">[EYE AF]</text>
          </>
        );

      // ── Cowboy Shot (Mid-Thigh Up) ──
      case 'cowboy_shot':
        return (
          <>
            {/* Frame boundary */}
            <rect x="70" y="25" width="160" height="150" rx="6" fill="none" stroke="#475569" strokeWidth="1.5" />
            
            {/* Subject framed to mid-thigh */}
            <circle cx="150" cy="48" r="13" fill={subjectAccent} />
            <path d="M 130 68 L 170 68 L 178 120 L 122 120 Z" fill={subjectFill} />
            {/* Thighs cutting off at bottom edge */}
            <rect x="126" y="120" width="20" height="50" fill={subjectFill} opacity="0.8" />
            <rect x="154" y="120" width="20" height="50" fill={subjectFill} opacity="0.8" />
            
            {/* Cut line marker */}
            <line x1="50" y1="165" x2="250" y2="165" stroke={cameraFill} strokeWidth="2" strokeDasharray="4 3" />
            <text x="175" y="160" fill={cameraFill} fontSize="9" fontWeight="bold" fontFamily="monospace">CROP: MID-THIGH</text>
            
            <text x="20" y="35" fill={textBright} fontSize="10" fontWeight="bold">COWBOY SHOT</text>
            <text x="20" y="48" fill={textMuted} fontSize="8" fontFamily="monospace">American frame</text>
          </>
        );

      // ── Over-the-Shoulder (OTS) ──
      case 'over_the_shoulder':
        return (
          <>
            {/* Foreground Person (Dark out-of-focus shoulder silhouette on left) */}
            <path d="M 20 180 L 20 110 Q 70 95 100 120 L 100 180 Z" fill="#0f172a" stroke="#334155" strokeWidth="2" />
            <text x="25" y="150" fill={textMuted} fontSize="8" fontFamily="monospace">FOREGROUND</text>
            <text x="25" y="160" fill={textMuted} fontSize="8" fontFamily="monospace">SHOULDER</text>
            
            {/* Main Subject in background (in sharp focus) */}
            <circle cx="190" cy="75" r="16" fill={subjectAccent} />
            <path d="M 170 100 L 210 100 L 220 180 L 160 180 Z" fill={subjectFill} />
            
            {/* Focus indicator on background subject */}
            <circle cx="190" cy="75" r="24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="130" y="30" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">OVER-THE-SHOULDER</text>
            <text x="130" y="43" fill={textMuted} fontSize="8" fontFamily="monospace">Conversational depth</text>
          </>
        );

      // ── Backlit Silhouette ──
      case 'silhouette':
        return (
          <>
            {/* Bright back window / light source */}
            <rect x="70" y="30" width="160" height="145" rx="8" fill="#fef08a" opacity="0.85" />
            {/* Light rays emitting */}
            <line x1="70" y1="30" x2="30" y2="10" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 3" />
            <line x1="230" y1="30" x2="270" y2="10" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 3" />
            
            {/* Pure Black Silhouette in front of window */}
            <circle cx="150" cy="65" r="14" fill="#020617" />
            <path d="M 130 85 L 170 85 L 180 175 L 120 175 Z" fill="#020617" />
            
            {/* Radiant golden rim glow outline */}
            <circle cx="150" cy="65" r="14" fill="none" stroke="#f59e0b" strokeWidth="2" />
            
            <text x="20" y="25" fill="#f59e0b" fontSize="10" fontWeight="bold" fontFamily="monospace">BACKLIT WINDOW</text>
            <text x="20" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Pure rim silhouette</text>
          </>
        );

      // ── All Fours (Pose & Rear Low Angle) ──
      case 'all_fours_behind':
      case 'all_fours_side':
        return (
          <>
            {/* Mattress / Ground plane */}
            <line x1="20" y1="160" x2="280" y2="160" stroke="#475569" strokeWidth="1.5" />
            
            {/* Figure on all fours (side/three-quarter) */}
            {/* Knees & lower legs on ground */}
            <line x1="180" y1="160" x2="210" y2="160" stroke={subjectFill} strokeWidth="8" strokeLinecap="round" />
            <line x1="90" y1="160" x2="90" y2="125" stroke={subjectFill} strokeWidth="8" strokeLinecap="round" />
            {/* Arched back connecting hips to shoulders */}
            <path d="M 195 125 Q 145 140 90 125" fill="none" stroke={subjectAccent} strokeWidth="10" strokeLinecap="round" />
            {/* Head looking forward */}
            <circle cx="70" cy="115" r="11" fill={subjectAccent} />
            
            {/* Camera at low angle */}
            <rect x="235" y="120" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="235,123 225,119 225,135 235,131" fill={cameraFill} />
            <path d="M 225 127 L 70 105 L 195 160 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="20" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">ALL FOURS POSE</text>
            <text x="20" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Arched spine contour</text>
          </>
        );

      // ── Prone Arch (On Stomach, Upper Body Lifted) ──
      case 'prone_arch':
      case 'arching_profile':
        return (
          <>
            <line x1="20" y1="160" x2="280" y2="160" stroke="#475569" strokeWidth="1.5" />
            
            {/* Legs on mattress */}
            <line x1="150" y1="158" x2="260" y2="158" stroke={subjectFill} strokeWidth="9" strokeLinecap="round" />
            {/* Arched upward chest & head */}
            <path d="M 150 158 Q 110 150 90 100" fill="none" stroke={subjectAccent} strokeWidth="9" strokeLinecap="round" />
            {/* Head tilted up/back */}
            <circle cx="85" cy="85" r="12" fill={subjectAccent} />
            {/* Arms propping chest */}
            <line x1="105" y1="125" x2="105" y2="160" stroke={subjectFill} strokeWidth="6" strokeLinecap="round" />
            
            {/* Camera pointing at side profile */}
            <rect x="25" y="80" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="47,83 57,79 57,95 47,91" fill={cameraFill} />
            <path d="M 57 87 L 180 60 L 220 160 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="25" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">ARCHING PROFILE</text>
            <text x="25" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">Dramatic S-curve spine</text>
          </>
        );

      // ── Doorway / Peephole Voyeur ──
      case 'voyeur_doorway':
      case 'voyeur_curtain':
      case 'peephole':
        return (
          <>
            {/* Doorway frame border */}
            <rect x="20" y="20" width="55" height="160" fill="#0f172a" />
            <rect x="225" y="20" width="55" height="160" fill="#0f172a" />
            <line x1="75" y1="20" x2="75" y2="180" stroke="#334155" strokeWidth="2" />
            <line x1="225" y1="20" x2="225" y2="180" stroke="#334155" strokeWidth="2" />
            
            {/* Visible room in background */}
            <rect x="75" y="20" width="150" height="160" fill="#1e293b" />
            
            {/* Subject inside room unaware */}
            <circle cx="150" cy="75" r="13" fill={subjectAccent} />
            <path d="M 135 95 L 165 95 L 170 170 L 130 170 Z" fill={subjectFill} />
            
            <text x="90" y="15" fill={cameraFill} fontSize="9" fontWeight="bold" fontFamily="monospace">DOORWAY FRAME</text>
            <text x="85" y="175" fill={textMuted} fontSize="8" fontFamily="monospace">Candid unseen observer</text>
          </>
        );

      // ── Default / Neutral Eye-Level Frontal ──
      default:
        return (
          <>
            {/* Ground plane */}
            <line x1="20" y1="170" x2="280" y2="170" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
            
            {/* Subject standing neutral */}
            <circle cx="190" cy="55" r="13" fill={subjectAccent} />
            <path d="M 175 75 L 205 75 L 210 170 L 170 170 Z" fill={subjectFill} />
            
            {/* Camera at eye level pointing straight */}
            <rect x="45" y="47" width="22" height="15" rx="3" fill={cameraFill} />
            <polygon points="67,50 77,46 77,62 67,58" fill={cameraFill} />
            
            {/* Tripod */}
            <line x1="48" y1="62" x2="38" y2="170" stroke={cameraFill} strokeWidth="1.5" />
            <line x1="63" y1="62" x2="73" y2="170" stroke={cameraFill} strokeWidth="1.5" />
            
            {/* Horizontal view cone */}
            <path d="M 77 54 L 230 20 L 230 170 Z" fill={fovFill} stroke={fovStroke} strokeWidth="1.5" strokeDasharray="3 3" />
            
            <text x="25" y="25" fill={cameraFill} fontSize="10" fontWeight="bold" fontFamily="monospace">EYE-LEVEL (0°)</text>
            <text x="25" y="38" fill={textMuted} fontSize="8" fontFamily="monospace">50mm Natural perspective</text>
          </>
        );
    }
  };

  return (
    <div className={`relative bg-[#0d0f14] overflow-hidden select-none border border-white/5 rounded-t-2xl ${className}`}>
      <svg
        viewBox="0 0 300 190"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Subtle grid lines background */}
        <defs>
          <pattern id={`grid-${angleId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="20" y2="0" stroke={gridStroke} strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="20" stroke={gridStroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="300" height="190" fill={`url(#grid-${angleId})`} />

        {/* Cinematography Diagram Elements */}
        {renderContent()}
      </svg>
    </div>
  );
};
