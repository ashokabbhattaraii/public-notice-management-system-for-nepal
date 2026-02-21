'use client';

export function DecorativeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated gradient orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-3xl animate-pulse opacity-60 float" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-accent/20 to-primary/20 rounded-full blur-3xl animate-pulse opacity-60 float delay-300" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-secondary/10 to-accent/10 rounded-full blur-3xl animate-pulse opacity-40" style={{ animationDelay: '4s' }} />

      {/* Decorative curved shapes */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'oklch(0.68 0.24 270)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'oklch(0.70 0.22 320)', stopOpacity: 0.1 }} />
          </linearGradient>
          <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'oklch(0.75 0.26 180)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'oklch(0.72 0.22 220)', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        
        {/* Organic flowing curves */}
        <path
          d="M 0,200 Q 150,150 300,200 T 600,200 T 900,200 T 1200,200 L 1200,0 L 0,0 Z"
          fill="url(#grad1)"
          className="animate-pulse"
        />
        <path
          d="M 1200,400 Q 1050,350 900,400 T 600,400 T 300,400 T 0,400 L 0,600 L 1200,600 Z"
          fill="url(#grad2)"
          className="animate-pulse"
          style={{ animationDelay: '2s' }}
        />
        
        {/* Playful dots pattern */}
        <g opacity="0.4">
          {[...Array(20)].map((_, i) => (
            <circle
              key={i}
              cx={Math.random() * 1200}
              cy={Math.random() * 800}
              r={Math.random() * 3 + 1}
              fill="url(#grad1)"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
