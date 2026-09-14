import type { JSX } from 'react';

/**
 * Ilustrações originais em SVG usadas como imagem padrão dos produtos.
 * São vetoriais: ficam nítidas em qualquer tela e não dependem de rede.
 * O vendedor pode substituir por uma foto própria em Produtos > Imagem.
 */

type Scene = {
  bg: [string, string];
  render: () => JSX.Element;
};

const plate = (y = 300, w = 150, fill = '#f7e7dd') => (
  <>
    <ellipse cx="200" cy={y + 10} rx={w} ry="16" fill="#00000012" />
    <ellipse cx="200" cy={y} rx={w} ry="18" fill={fill} />
    <ellipse cx="200" cy={y - 4} rx={w - 12} ry="13" fill="#fffaf6" />
  </>
);

const strawberry = (x: number, y: number, s = 1, rot = 0) => (
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`}>
    <path d="M0 22c11 0 19-9 19-20 0-8-8-14-19-14S-19-6-19 2c0 11 8 20 19 20z" fill="url(#gStraw)" />
    <path d="M-14-13c5-6 23-6 28 0 3 4-3 6-14 6s-17-2-14-6z" fill="#67b26a" />
    <path d="M0-20v8" stroke="#4f9152" strokeWidth="3" strokeLinecap="round" />
    <circle cx="-7" cy="2" r="1.6" fill="#ffd9d9" opacity=".9" />
    <circle cx="5" cy="8" r="1.6" fill="#ffd9d9" opacity=".9" />
    <circle cx="8" cy="-4" r="1.6" fill="#ffd9d9" opacity=".9" />
    <circle cx="-3" cy="13" r="1.6" fill="#ffd9d9" opacity=".9" />
  </g>
);

const sprinkles = (cx: number, cy: number, color = '#ffffff') =>
  [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * 61) % 360;
    const r = 18 + (i % 3) * 9;
    const x = cx + Math.cos((a * Math.PI) / 180) * r;
    const y = cy + Math.sin((a * Math.PI) / 180) * r * 0.55;
    return <rect key={i} x={x} y={y} width="8" height="3.2" rx="1.6" fill={color} opacity=".85" transform={`rotate(${a} ${x} ${y})`} />;
  });

const drip = (y: number, fill: string) => (
  <path
    d={`M50 ${y} h300 v26 q-16 22 -32 0 q-14 26 -30 2 q-18 30 -34 2 q-16 24 -32 0 q-15 28 -31 1 q-17 26 -33 1 q-16 24 -32 0 q-18 26 -34 1 q-9 12 -12 -3 z`}
    fill={fill}
  />
);

const cake = (opts: { body: string[]; icing: string; drip: string; top: JSX.Element }) => (
  <>
    {plate()}
    <g>
      <rect x="62" y="150" width="276" height="150" rx="16" fill={opts.body[0]} />
      <rect x="62" y="196" width="276" height="10" fill={opts.body[1]} opacity=".95" />
      <rect x="62" y="240" width="276" height="10" fill={opts.body[1]} opacity=".95" />
      <rect x="62" y="150" width="276" height="150" rx="16" fill="url(#gShade)" />
      <rect x="50" y="118" width="300" height="52" rx="20" fill={opts.icing} />
      {drip(150, opts.drip)}
      <ellipse cx="200" cy="124" rx="150" ry="22" fill={opts.icing} />
      <ellipse cx="200" cy="121" rx="134" ry="17" fill="#ffffff" opacity=".18" />
    </g>
    {opts.top}
  </>
);

const scenes: Record<string, Scene> = {
  'bolo-chocolate': {
    bg: ['#f6ece4', '#e8d3c4'],
    render: () => cake({
      body: ['#6b4230', '#8d5b41'], icing: '#4a2c1e', drip: '#3d2318',
      top: (
        <g>
          {[110, 155, 200, 245, 290].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 118 l14 -26 l-28 0 z`} fill="#5b3524" opacity={0.9 - i * 0.05} />
              <circle cx={x} cy="112" r="9" fill="#7a4b33" />
            </g>
          ))}
          <circle cx="200" cy="104" r="12" fill="#b0243d" />
          <path d="M200 92c2-8 9-11 14-10-2 7-7 10-14 10z" fill="#4f9152" />
        </g>
      ),
    }),
  },
  'bolo-morango': {
    bg: ['#fdeef1', '#f6d7de'],
    render: () => cake({
      body: ['#fff6ef', '#ffd2dd'], icing: '#fff1f4', drip: '#ffd9e2',
      top: (
        <g>
          {strawberry(130, 100, 0.95, -12)}
          {strawberry(200, 92, 1.1, 0)}
          {strawberry(270, 100, 0.95, 12)}
          {sprinkles(200, 130, '#ff9bb4')}
        </g>
      ),
    }),
  },
  'bolo-ninho': {
    bg: ['#fdf5ea', '#f2e0c8'],
    render: () => cake({
      body: ['#fffaf0', '#ffe9c9'], icing: '#fff8ec', drip: '#f6e3c4',
      top: (
        <g>
          {[120, 160, 200, 240, 280].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i % 2 ? 104 : 98})`}>
              <circle r="15" fill="#fffdf8" stroke="#f0dcc0" strokeWidth="2" />
              <circle r="15" fill="url(#gShine)" />
            </g>
          ))}
          <circle cx="200" cy="82" r="8" fill="#e5c79a" />
        </g>
      ),
    }),
  },
  'bolo-redvelvet': {
    bg: ['#fbe9ea', '#f0cfd2'],
    render: () => cake({
      body: ['#a3252f', '#fff3f2'], icing: '#fffaf8', drip: '#ffe9e6',
      top: (
        <g>
          {[135, 200, 265].map((x) => (
            <g key={x}>
              <circle cx={x} cy="104" r="14" fill="#fffdfc" />
              <circle cx={x} cy="104" r="14" fill="url(#gShine)" />
              <rect x={x - 4} y="80" width="8" height="8" rx="2" fill="#a3252f" transform={`rotate(20 ${x} 84)`} />
            </g>
          ))}
        </g>
      ),
    }),
  },
  'brigadeiro': {
    bg: ['#f3e6dd', '#e2c8b6'],
    render: () => (
      <>
        {plate(298, 140)}
        {[
          [126, 236, 1], [200, 214, 1.15], [274, 236, 1], [163, 268, 0.92], [237, 268, 0.92], [200, 292, 0.8],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M-46 22c0-6 5-10 10-12h72c5 2 10 6 10 12 0 8-20 14-46 14s-46-6-46-14z" fill="#e3c6a8" />
            <path d="M-38 10h76l-6 16h-64z" fill="#f3ddc4" />
            <circle cy="-6" r="34" fill="url(#gChoc)" />
            <circle cy="-6" r="34" fill="url(#gShine)" />
            {[...Array(14)].map((_, k) => {
              const a = (k * 137) % 360;
              const r = 8 + (k % 4) * 7;
              return <circle key={k} cx={Math.cos(a) * r} cy={-6 + Math.sin(a) * r} r="2.6" fill="#2f1b12" />;
            })}
          </g>
        ))}
      </>
    ),
  },
  'beijinho': {
    bg: ['#f7f1e8', '#e8ddcd'],
    render: () => (
      <>
        {plate(298, 140)}
        {[
          [126, 236, 1], [200, 214, 1.15], [274, 236, 1], [163, 268, 0.92], [237, 268, 0.92], [200, 292, 0.8],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path d="M-46 22c0-6 5-10 10-12h72c5 2 10 6 10 12 0 8-20 14-46 14s-46-6-46-14z" fill="#cfe3f3" />
            <path d="M-38 10h76l-6 16h-64z" fill="#e8f2fb" />
            <circle cy="-6" r="34" fill="#fffdf8" />
            <circle cy="-6" r="34" fill="url(#gShine)" />
            {[...Array(22)].map((_, k) => {
              const a = (k * 97) % 360;
              const r = 6 + (k % 5) * 6;
              return <rect key={k} x={Math.cos(a) * r} y={-6 + Math.sin(a) * r} width="6" height="2.4" rx="1.2" fill="#f0e6d6" transform={`rotate(${a} 0 0)`} />;
            })}
            <circle cy="-16" r="6" fill="#9db66f" />
          </g>
        ))}
      </>
    ),
  },
  'cupcake-chocolate': {
    bg: ['#f4e9e0', '#e5cdbb'],
    render: () => (
      <>
        {plate(312, 120)}
        <g transform="translate(200 40)">
          <path d="M-72 130h144l-18 122a16 16 0 0 1-16 14h-60a16 16 0 0 1-16-14z" fill="#c98b6a" />
          {[-56, -32, -8, 16, 40].map((x) => <rect key={x} x={x} y="130" width="14" height="136" rx="6" fill="#b8795a" opacity=".55" />)}
          <path d="M-74 122h148v16h-148z" fill="#a96a4d" />
          <path d="M-64 122c0-30 16-48 30-56-6-24 12-42 34-42s40 18 34 42c14 8 30 26 30 56z" fill="url(#gChoc)" />
          <path d="M-52 96c14-8 32-6 42 4 12-12 34-12 46 0 8-8 20-10 30-6" stroke="#ffffff" strokeOpacity=".25" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="0" cy="-44" r="11" fill="#b0243d" />
          <path d="M0 -55c2-8 9-11 14-10-2 7-7 10-14 10z" fill="#4f9152" />
          {sprinkles(0, 60, '#ffd7a8')}
        </g>
      </>
    ),
  },
  'cupcake-baunilha': {
    bg: ['#fdf1f3', '#f3d9de'],
    render: () => (
      <>
        {plate(312, 120)}
        <g transform="translate(200 40)">
          <path d="M-72 130h144l-18 122a16 16 0 0 1-16 14h-60a16 16 0 0 1-16-14z" fill="#f2c9d3" />
          {[-56, -32, -8, 16, 40].map((x) => <rect key={x} x={x} y="130" width="14" height="136" rx="6" fill="#e5b1bf" opacity=".6" />)}
          <path d="M-74 122h148v16h-148z" fill="#e2a8b8" />
          <path d="M-64 122c0-30 16-48 30-56-6-24 12-42 34-42s40 18 34 42c14 8 30 26 30 56z" fill="#fff4f6" />
          <path d="M-64 122c0-30 16-48 30-56-6-24 12-42 34-42s40 18 34 42c14 8 30 26 30 56z" fill="url(#gShine)" />
          <path d="M-50 98c12-10 30-8 40 2 12-12 34-12 46 0" stroke="#f6c3cf" strokeWidth="7" fill="none" strokeLinecap="round" />
          {strawberry(0, -46, 0.8)}
          {sprinkles(0, 60, '#ff9fb6')}
        </g>
      </>
    ),
  },
  'torta-morango': {
    bg: ['#fdeef0', '#f4d5da'],
    render: () => (
      <>
        {plate(304, 156)}
        <g>
          <path d="M58 200h284l-14 84a22 22 0 0 1-22 18H94a22 22 0 0 1-22-18z" fill="#e6b57f" />
          <path d="M58 200h284l-6 34H64z" fill="#f0c894" />
          <ellipse cx="200" cy="200" rx="142" ry="34" fill="#fff6f7" />
          <ellipse cx="200" cy="196" rx="128" ry="28" fill="#fff" />
          <ellipse cx="200" cy="196" rx="128" ry="28" fill="url(#gShine)" />
          {[[140, 182], [200, 172], [260, 182], [170, 206], [230, 206]].map(([x, y], i) => (
            <g key={i}>{strawberry(x, y, 0.72)}</g>
          ))}
          <path d="M72 216c30 12 226 12 256 0" stroke="#ffd7de" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
      </>
    ),
  },
  'torta-chocolate': {
    bg: ['#f2e7de', '#dfc6b3'],
    render: () => (
      <>
        {plate(304, 156)}
        <g>
          <path d="M58 200h284l-14 84a22 22 0 0 1-22 18H94a22 22 0 0 1-22-18z" fill="#7a4a33" />
          <path d="M58 200h284l-6 34H64z" fill="#966043" />
          <ellipse cx="200" cy="200" rx="142" ry="34" fill="#432618" />
          <ellipse cx="200" cy="194" rx="128" ry="28" fill="#5a3222" />
          <ellipse cx="200" cy="194" rx="128" ry="28" fill="url(#gShine)" />
          {[120, 160, 200, 240, 280].map((x, i) => (
            <g key={x} transform={`translate(${x} ${i % 2 ? 190 : 182})`}>
              <circle r="13" fill="#6d3f2b" />
              <circle r="13" fill="url(#gShine)" />
              <path d="M-6 -14 l6 -12 l6 12z" fill="#8b5639" />
            </g>
          ))}
          <path d="M72 216c30 12 226 12 256 0" stroke="#c99a76" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".7" />
        </g>
      </>
    ),
  },
  'kit-festa': {
    bg: ['#fdf0e6', '#f0d6c0'],
    render: () => (
      <>
        <path d="M60 120h60v22H60z M150 96h60v22h-60z M240 118h60v22h-60z" fill="#ffffff" opacity=".0" />
        {[['#ff9fb6', 80], ['#ffd08a', 130], ['#9fd4c6', 180], ['#c9a6ea', 230], ['#ff9fb6', 280], ['#ffd08a', 330]].map(([c, x], i) => (
          <g key={i}>
            <path d={`M${x} 40 l10 18 l-10 18 l-10 -18z`} fill={c as string} opacity=".85" />
            <path d={`M${x} 40 v-22`} stroke="#d9c0ad" strokeWidth="3" />
          </g>
        ))}
        {plate(322, 160)}
        <g>
          <rect x="120" y="150" width="160" height="112" rx="14" fill="#fff6ef" />
          <rect x="120" y="150" width="160" height="112" rx="14" fill="url(#gShade)" />
          <rect x="112" y="124" width="176" height="36" rx="16" fill="#ffd9e2" />
          <ellipse cx="200" cy="128" rx="88" ry="16" fill="#fff1f4" />
          {[160, 200, 240].map((x) => <circle key={x} cx={x} cy="122" r="8" fill="#ff9fb6" />)}
          <rect x="188" y="88" width="24" height="34" rx="6" fill="#ffe9c9" />
          <path d="M200 88c0-10 8-14 8-22-10 4-16 12-8 22z" fill="#ffb24d" />
        </g>
        <g transform="translate(78 236) scale(.72)">
          <path d="M-46 22c0-6 5-10 10-12h72c5 2 10 6 10 12 0 8-20 14-46 14s-46-6-46-14z" fill="#e3c6a8" />
          <circle cy="-6" r="32" fill="url(#gChoc)" /><circle cy="-6" r="32" fill="url(#gShine)" />
        </g>
        <g transform="translate(322 236) scale(.72)">
          <path d="M-46 22c0-6 5-10 10-12h72c5 2 10 6 10 12 0 8-20 14-46 14s-46-6-46-14z" fill="#cfe3f3" />
          <circle cy="-6" r="32" fill="#fffdf8" /><circle cy="-6" r="32" fill="url(#gShine)" />
        </g>
      </>
    ),
  },
  'caixa-doces': {
    bg: ['#f7eee6', '#e6d2c0'],
    render: () => (
      <>
        <g>
          <path d="M70 168h260l-10 150a18 18 0 0 1-18 16H98a18 18 0 0 1-18-16z" fill="#b57b56" />
          <path d="M70 168h260l-6 30H76z" fill="#cf9470" />
          <rect x="88" y="196" width="224" height="112" rx="10" fill="#f6e6d6" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => {
              const cx = 118 + c * 55;
              const cy = 222 + r * 34;
              const kinds = ['#5b3524', '#fffdf8', '#e59ab0', '#f0c874'];
              const fill = kinds[(r + c) % 4];
              return (
                <g key={`${r}-${c}`}>
                  <ellipse cx={cx} cy={cy + 10} rx="20" ry="7" fill="#00000010" />
                  <circle cx={cx} cy={cy} r="18" fill={fill} />
                  <circle cx={cx} cy={cy} r="18" fill="url(#gShine)" />
                </g>
              );
            }),
          )}
          <path d="M60 156h280v20H60z" fill="#8d5b41" opacity=".25" />
          <path d="M196 120h8v52h-8z" fill="#ff9fb6" opacity=".0" />
          <path d="M200 168c-40-6-60-34-38-48 16-10 34 10 38 26 4-16 22-36 38-26 22 14 2 42-38 48z" fill="#ff9fb6" />
          <circle cx="200" cy="164" r="10" fill="#ffb9c9" />
        </g>
      </>
    ),
  },
  'salgados': {
    bg: ['#fdf2e2', '#f0dcbc'],
    render: () => (
      <>
        {plate(308, 150)}
        {[[140, 250, 1, -14], [200, 226, 1.12, 0], [262, 250, 1, 14], [172, 286, 0.86, -6], [232, 286, 0.86, 8]].map(([x, y, s, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${r})`}>
            <path d="M0-58c16 0 30 20 30 40 0 18-13 30-30 30s-30-12-30-30c0-20 14-40 30-40z" fill="url(#gFried)" />
            <path d="M0-58c6 4 8 12 6 18" stroke="#c98a3e" strokeWidth="4" fill="none" strokeLinecap="round" />
            {[...Array(10)].map((_, k) => {
              const a = (k * 121) % 360;
              const rr = 8 + (k % 3) * 8;
              return <circle key={k} cx={Math.cos(a) * rr} cy={-10 + Math.sin(a) * rr} r="2" fill="#e8b46a" opacity=".8" />;
            })}
          </g>
        ))}
      </>
    ),
  },
  'bebidas': {
    bg: ['#eef6f4', '#d6e9e2'],
    render: () => (
      <>
        {plate(316, 130, '#eaf3ef')}
        <g transform="translate(200 0)">
          <path d="M-58 90h116l-14 200a22 22 0 0 1-22 20h-44a22 22 0 0 1-22-20z" fill="#ffffff" opacity=".55" />
          <path d="M-52 132h104l-12 158a18 18 0 0 1-18 16h-44a18 18 0 0 1-18-16z" fill="url(#gJuice)" />
          <ellipse cx="0" cy="132" rx="52" ry="12" fill="#ffd9a0" />
          <path d="M-58 90h116l-3 42h-110z" fill="#ffffff" opacity=".35" />
          <rect x="10" y="40" width="10" height="110" rx="5" fill="#ff9fb6" transform="rotate(12 15 95)" />
          <circle cx="-34" cy="122" r="16" fill="#ffb24d" />
          <path d="M-34 106a16 16 0 0 0 0 32z" fill="#ffd08a" />
          <path d="M-40 200c8 10 20 10 28 0" stroke="#ffffff" strokeOpacity=".5" strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      </>
    ),
  },
  'personalizados': {
    bg: ['#f3eefb', '#ded2f2'],
    render: () => (
      <>
        {plate(302, 152)}
        <g>
          <rect x="84" y="176" width="232" height="126" rx="16" fill="#fff6ef" />
          <rect x="84" y="176" width="232" height="126" rx="16" fill="url(#gShade)" />
          <rect x="74" y="146" width="252" height="40" rx="18" fill="#cbb6f0" />
          <ellipse cx="200" cy="150" rx="126" ry="18" fill="#e2d5fa" />
          {[120, 160, 200, 240, 280].map((x, i) => (
            <path key={x} d={`M${x} 140 q10 -14 0 -26 q-10 12 0 26z`} fill={['#ff9fb6', '#ffd08a', '#9fd4c6', '#ffb1c8', '#c9a6ea'][i]} />
          ))}
          <path d="M200 106c-3-14 6-24 16-22-2 12-8 19-16 22z" fill="#f0c874" />
          <rect x="96" y="226" width="208" height="38" rx="19" fill="#ffffff" opacity=".55" />
          <path d="M128 245h144" stroke="#c0a7e8" strokeWidth="6" strokeLinecap="round" strokeDasharray="4 16" />
        </g>
      </>
    ),
  },
  'pao-de-mel': {
    bg: ['#f6ece1', '#e4cdb6'],
    render: () => (
      <>
        {plate(306, 144)}
        {[[144, 252, 1], [256, 252, 1], [200, 214, 1.08]].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <rect x="-44" y="-44" width="88" height="88" rx="18" fill="url(#gChoc)" />
            <rect x="-44" y="-44" width="88" height="88" rx="18" fill="url(#gShine)" />
            <path d="M-40 -20c14 10 30 10 44 0s30-10 36 0" stroke="#ffffff" strokeOpacity=".22" strokeWidth="6" fill="none" />
            <circle cx="0" cy="6" r="9" fill="#f0c874" opacity=".85" />
          </g>
        ))}
      </>
    ),
  },
  'docinhos-gourmet': {
    bg: ['#fbf0f4', '#eed6e0'],
    render: () => (
      <>
        {plate(300, 146)}
        {[['#5b3524', 120, 240], ['#e59ab0', 175, 224], ['#f0c874', 230, 224], ['#9fd4c6', 285, 240], ['#fffdf8', 148, 284], ['#c9a6ea', 205, 292], ['#f2a65a', 262, 284]].map(
          ([c, x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-34 18c0-5 4-8 8-9h52c4 1 8 4 8 9 0 6-16 11-34 11s-34-5-34-11z" fill="#f0dcc4" />
              <circle cy="-4" r="26" fill={c as string} />
              <circle cy="-4" r="26" fill="url(#gShine)" />
              <path d="M0 -30c2-6 8-8 12-7-2 6-6 8-12 7z" fill="#b9d39a" opacity={i % 2 ? 1 : 0} />
            </g>
          ),
        )}
      </>
    ),
  },
  'naked-cake': {
    bg: ['#fbf4ea', '#eddcc6'],
    render: () => (
      <>
        {plate(300)}
        <g>
          <rect x="84" y="150" width="232" height="46" rx="10" fill="#f0d9b6" />
          <rect x="84" y="200" width="232" height="46" rx="10" fill="#f0d9b6" />
          <rect x="84" y="250" width="232" height="46" rx="10" fill="#f0d9b6" />
          {[196, 246].map((y) => <rect key={y} x="84" y={y - 8} width="232" height="10" rx="5" fill="#fff6ef" />)}
          <rect x="84" y="150" width="232" height="146" rx="10" fill="url(#gShade)" />
          <ellipse cx="200" cy="150" rx="116" ry="16" fill="#fffaf2" />
          {[[150, 140], [200, 132], [250, 140]].map(([x, y], i) => <g key={i}>{strawberry(x, y, 0.8)}</g>)}
          <path d="M126 142c-10-10-6-22 4-22s12 12 4 22z" fill="#9db66f" />
          <path d="M276 142c-10-10-6-22 4-22s12 12 4 22z" fill="#9db66f" />
        </g>
      </>
    ),
  },
};

const fallback: Scene = scenes['bolo-chocolate'];

export function ProductArt({ art, className }: { art: string; className?: string }) {
  const scene = scenes[art] ?? fallback;
  return (
    <svg className={className} viewBox="0 0 400 360" role="presentation" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="gBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.bg[0]} />
          <stop offset="100%" stopColor={scene.bg[1]} />
        </linearGradient>
        <linearGradient id="gShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity=".12" />
          <stop offset="35%" stopColor="#fff" stopOpacity=".12" />
          <stop offset="100%" stopColor="#000" stopOpacity=".14" />
        </linearGradient>
        <linearGradient id="gShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".4" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gChoc" cx="35%" cy="28%">
          <stop offset="0%" stopColor="#8a5738" />
          <stop offset="100%" stopColor="#452718" />
        </radialGradient>
        <linearGradient id="gStraw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2566a" />
          <stop offset="100%" stopColor="#c8203a" />
        </linearGradient>
        <linearGradient id="gFried" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4c078" />
          <stop offset="100%" stopColor="#d9963f" />
        </linearGradient>
        <linearGradient id="gJuice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb24d" />
          <stop offset="100%" stopColor="#f2813a" />
        </linearGradient>
      </defs>
      <rect width="400" height="360" fill="url(#gBg)" />
      <circle cx="330" cy="62" r="64" fill="#ffffff" opacity=".22" />
      <circle cx="58" cy="286" r="46" fill="#ffffff" opacity=".16" />
      {scene.render()}
    </svg>
  );
}

export const artKeys = Object.keys(scenes);

export function ProductImage({ art, image, alt, className }: { art: string; image?: string; alt: string; className?: string }) {
  if (image) return <img src={image} alt={alt} className={className} loading="lazy" />;
  return <ProductArt art={art} className={className} />;
}
