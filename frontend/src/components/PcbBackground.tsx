export default function PcbBackground({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden text-accent opacity-[0.07] ${className}`}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="pcb-traces"
            x="0"
            y="0"
            width="600"
            height="600"
            patternUnits="userSpaceOnUse"
          >
            {/* ================================================
                QFN CHIP #1 — main MCU, centered at (220, 230)
                ================================================ */}
            <rect x="198" y="208" width="44" height="44" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Thermal via grid (3×3) */}
            <circle cx="210" cy="220" r="2" fill="currentColor" />
            <circle cx="220" cy="220" r="2" fill="currentColor" />
            <circle cx="230" cy="220" r="2" fill="currentColor" />
            <circle cx="210" cy="230" r="2" fill="currentColor" />
            <circle cx="220" cy="230" r="2" fill="currentColor" />
            <circle cx="230" cy="230" r="2" fill="currentColor" />
            <circle cx="210" cy="240" r="2" fill="currentColor" />
            <circle cx="220" cy="240" r="2" fill="currentColor" />
            <circle cx="230" cy="240" r="2" fill="currentColor" />
            <circle cx="194" cy="198" r="2.5" fill="currentColor" />
            {/* Top pads */}
            <rect x="201" y="194" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="211" y="194" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="221" y="194" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="231" y="194" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Bottom pads */}
            <rect x="201" y="253" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="211" y="253" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="221" y="253" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="231" y="253" width="6" height="13" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Left pads */}
            <rect x="184" y="211" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="184" y="221" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="184" y="231" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="184" y="241" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Right pads */}
            <rect x="243" y="211" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="243" y="221" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="243" y="231" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="243" y="241" width="13" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* ================================================
                QFN CHIP #2 — secondary IC (e.g. flash), at (480, 480)
                ================================================ */}
            <rect x="460" y="460" width="38" height="38" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Thermal vias (2×2) */}
            <circle cx="472" cy="472" r="2" fill="currentColor" />
            <circle cx="486" cy="472" r="2" fill="currentColor" />
            <circle cx="472" cy="486" r="2" fill="currentColor" />
            <circle cx="486" cy="486" r="2" fill="currentColor" />
            <circle cx="456" cy="456" r="2" fill="currentColor" />
            {/* Top pads */}
            <rect x="465" y="449" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="475" y="449" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="485" y="449" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Bottom pads */}
            <rect x="465" y="499" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="475" y="499" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="485" y="499" width="6" height="10" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Left pads */}
            <rect x="449" y="466" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="449" y="480" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Right pads */}
            <rect x="499" y="466" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="499" y="480" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* ================================================
                SOIC-8 CHIP #3 — e.g. USB-UART bridge, at (520, 90)
                ================================================ */}
            <rect x="505" y="60" width="30" height="55" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="510" cy="64" r="2" fill="currentColor" />
            {/* Left pads */}
            <rect x="496" y="66" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="496" y="78" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="496" y="90" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="496" y="102" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Right pads */}
            <rect x="534" y="66" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="534" y="78" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="534" y="90" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="534" y="102" width="10" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* ================================================
                SOIC-8 CHIP #4 — e.g. level shifter, at (60, 480)
                ================================================ */}
            <rect x="42" y="460" width="30" height="45" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="47" cy="464" r="2" fill="currentColor" />
            {/* Left pads */}
            <rect x="33" y="466" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="33" y="476" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="33" y="486" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="33" y="496" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Right pads */}
            <rect x="71" y="466" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="71" y="476" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="71" y="486" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="71" y="496" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* ================================================
                TRACES FROM CHIP #1 — power (fat) + signal (thin)
                ================================================ */}

            {/* Power: top-left pad to decoupling cap — 3.5px */}
            <path d="M204,194 L204,175 L192,163 L140,163" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Power: top-right pad to decoupling cap — 3.5px */}
            <path d="M234,194 L234,172 L250,156 L340,156" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />

            {/* Signal from top pad 2 */}
            <path d="M214,194 L214,170 L194,150 L130,150" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Signal from top pad 3 with serpentine */}
            <path d="M224,194 L224,165 L244,145 L310,145" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* Signal from right pad 1 */}
            <path d="M256,214 L290,214 L310,194 L310,140" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Signal from right pad 2 — wider data bus trace */}
            <path d="M256,224 L300,224 L328,252 L380,252" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Signal from right pad 3 */}
            <path d="M256,234 L295,234 L325,264 L325,320" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Signal from right pad 4, long route */}
            <path d="M256,244 L280,244 L306,270 L306,340 L330,364 L400,364" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* Signal from bottom pad 1, routing down-left */}
            <path d="M204,266 L204,290 L184,310 L120,310" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Power from bottom pad 2 — 3.5px */}
            <path d="M214,266 L214,300 L194,320 L194,380" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* Signal from bottom pad 3 */}
            <path d="M224,266 L224,295 L248,319 L310,319" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Signal from bottom pad 4 */}
            <path d="M234,266 L234,310 L258,334 L340,334" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* Signal from left pad 1 */}
            <path d="M184,214 L160,214 L140,194 L140,130" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Signal from left pad 2 */}
            <path d="M184,224 L150,224 L128,202 L80,202" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Differential pair from left pads 3 & 4 (USB) */}
            <path d="M184,234 L155,234 L130,259 L80,259" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M184,244 L158,244 L133,269 L80,269" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                TRACES FROM CHIP #2 — SPI flash
                ================================================ */}
            {/* SPI CLK — wider */}
            <path d="M468,449 L468,430 L448,410 L400,410" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* SPI MOSI */}
            <path d="M478,449 L478,425 L458,405 L400,405" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* SPI MISO */}
            <path d="M488,449 L488,420 L508,400 L550,400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Power to flash — 3.5px */}
            <path d="M449,469 L430,469 L410,449 L410,420" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* CS line */}
            <path d="M449,483 L420,483 L400,463 L400,430" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Bottom traces from chip #2 */}
            <path d="M468,509 L468,530 L448,550 L400,550" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M478,509 L478,540 L498,560 L540,560" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {/* Right side traces */}
            <path d="M509,469 L530,469 L548,451 L548,420" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M509,483 L540,483 L558,465 L558,430" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                TRACES FROM CHIP #3 — USB-UART
                ================================================ */}
            {/* TX trace */}
            <path d="M496,69 L470,69 L450,89 L430,89" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* RX trace */}
            <path d="M496,81 L475,81 L455,101 L430,101" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Power in — 3.5px */}
            <path d="M496,93 L480,93 L462,75 L462,40" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            {/* GND */}
            <path d="M496,105 L480,105 L462,123 L462,145" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* USB D+ / D- from right side */}
            <path d="M544,69 L570,69 L585,54" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M544,81 L573,81 L588,66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* CTS/RTS */}
            <path d="M544,93 L560,93 L575,108 L575,140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M544,105 L555,105 L568,118 L568,145" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* ================================================
                TRACES FROM CHIP #4 — level shifter
                ================================================ */}
            {/* Input side (left) */}
            <path d="M33,468 L15,468 L0,453" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M33,478 L18,478 L0,460" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M33,488 L20,488 L8,500 L8,530" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M33,498 L15,498 L0,513" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            {/* Output side (right) */}
            <path d="M81,468 L100,468 L115,453 L115,430" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M81,478 L105,478 L120,463 L120,430" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M81,488 L110,488 L130,508 L130,540" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M81,498 L100,498 L118,516 L118,550" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* ================================================
                SERPENTINE LENGTH-MATCHING
                ================================================ */}
            <path d="M310,145 L310,128 L322,116 L322,104 L310,92 L310,78 L322,66 L322,54 L310,42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* Second serpentine near chip #2 SPI lines */}
            <path d="M400,410 L388,410 L380,418 L372,410 L364,418 L356,410 L340,410" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                DIFFERENTIAL PAIR — USB to connector
                ================================================ */}
            <path d="M80,259 L50,259 L30,239 L30,160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M80,269 L53,269 L38,254 L38,160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                PASSIVE COMPONENTS — caps, resistors
                ================================================ */}

            {/* Decoupling cap #1 near chip #1 top-left power */}
            <rect x="120" y="158" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="100" y="158" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M100,163 L85,163" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Decoupling cap #2 near chip #1 top-right power */}
            <rect x="344" y="150" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="366" y="150" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M382,156 L400,156" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Pull-up resistor near bottom traces */}
            <rect x="314" y="316" width="14" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="334" y="316" width="14" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* Filter cap on right signal */}
            <rect x="382" y="247" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="400" y="247" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* Bypass cap near chip #2 */}
            <rect x="410" y="416" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="426" y="416" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* Bypass cap near chip #3 */}
            <rect x="440" y="36" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="456" y="36" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M462,40 L468,40 L468,36" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Resistor pair near chip #4 */}
            <rect x="110" y="426" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <rect x="124" y="426" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />

            {/* Resistor near bottom center */}
            <rect x="280" y="545" width="14" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="300" y="545" width="14" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* Cap near serpentine */}
            <rect x="320" y="36" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="336" y="36" width="12" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />

            {/* ================================================
                CRYSTAL OSCILLATOR — 4-pad package
                ================================================ */}
            <rect x="100" y="100" width="36" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" />
            <rect x="100" y="100" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="126" y="100" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="100" y="114" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="126" y="114" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M136,105 L145,105 L155,115 L155,130" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M136,119 L148,119 L160,131 L160,140" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                PIN HEADER — 6-pin through-hole
                ================================================ */}
            <circle cx="470" cy="180" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="180" r="3" fill="currentColor" />
            <circle cx="470" cy="206" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="206" r="3" fill="currentColor" />
            <circle cx="470" cy="232" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="232" r="3" fill="currentColor" />
            <circle cx="470" cy="258" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="258" r="3" fill="currentColor" />
            <circle cx="470" cy="284" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="284" r="3" fill="currentColor" />
            <circle cx="470" cy="310" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="470" cy="310" r="3" fill="currentColor" />
            {/* Header traces */}
            <path d="M463,180 L430,180 L410,200 L380,200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M463,206 L440,206 L418,228 L418,252" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M463,258 L440,258 L416,282 L416,340" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M463,310 L435,310 L408,337 L408,380" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* 2nd header — 4-pin (bottom-left area) */}
            <circle cx="20" cy="420" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="20" cy="420" r="3" fill="currentColor" />
            <circle cx="20" cy="446" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="20" cy="446" r="3" fill="currentColor" />
            <path d="M27,420 L50,420 L65,435" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M27,446 L45,446 L57,458" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                VIA STITCHING — flanking USB differential pair
                ================================================ */}
            <circle cx="20" cy="170" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="170" r="1" fill="currentColor" />
            <circle cx="20" cy="190" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="190" r="1" fill="currentColor" />
            <circle cx="20" cy="210" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="210" r="1" fill="currentColor" />
            <circle cx="20" cy="230" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="230" r="1" fill="currentColor" />
            <circle cx="20" cy="250" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="250" r="1" fill="currentColor" />
            <circle cx="48" cy="170" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="48" cy="170" r="1" fill="currentColor" />
            <circle cx="48" cy="190" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="48" cy="190" r="1" fill="currentColor" />
            <circle cx="48" cy="210" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="48" cy="210" r="1" fill="currentColor" />
            <circle cx="48" cy="230" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="48" cy="230" r="1" fill="currentColor" />
            <circle cx="48" cy="250" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="48" cy="250" r="1" fill="currentColor" />

            {/* Via stitching near chip #3 */}
            <circle cx="575" cy="125" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="575" cy="125" r="1" fill="currentColor" />
            <circle cx="575" cy="140" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="575" cy="140" r="1" fill="currentColor" />
            <circle cx="590" cy="125" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="590" cy="125" r="1" fill="currentColor" />
            <circle cx="590" cy="140" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="590" cy="140" r="1" fill="currentColor" />

            {/* ================================================
                SIGNAL VIAS — at trace endpoints
                ================================================ */}
            <circle cx="85" cy="163" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="85" cy="163" r="2" fill="currentColor" />
            <circle cx="400" cy="156" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="400" cy="156" r="2" fill="currentColor" />
            <circle cx="130" cy="150" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="130" cy="150" r="1.5" fill="currentColor" />
            <circle cx="140" cy="130" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="140" cy="130" r="1.5" fill="currentColor" />
            <circle cx="310" cy="140" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="310" cy="140" r="1.5" fill="currentColor" />
            <circle cx="310" cy="42" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="310" cy="42" r="1.5" fill="currentColor" />
            <circle cx="380" cy="252" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="380" cy="252" r="1.5" fill="currentColor" />
            <circle cx="325" cy="320" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="325" cy="320" r="1.5" fill="currentColor" />
            <circle cx="120" cy="310" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="120" cy="310" r="2" fill="currentColor" />
            <circle cx="194" cy="380" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="194" cy="380" r="2" fill="currentColor" />
            <circle cx="380" cy="200" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="380" cy="200" r="1.5" fill="currentColor" />
            <circle cx="340" cy="410" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="340" cy="410" r="1.5" fill="currentColor" />
            <circle cx="430" cy="89" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="430" cy="89" r="1.5" fill="currentColor" />
            <circle cx="430" cy="101" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="430" cy="101" r="1.5" fill="currentColor" />
            <circle cx="462" cy="145" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="462" cy="145" r="2" fill="currentColor" />
            <circle cx="400" cy="550" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="400" cy="550" r="1.5" fill="currentColor" />
            <circle cx="540" cy="560" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="540" cy="560" r="1.5" fill="currentColor" />
            <circle cx="548" cy="420" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="548" cy="420" r="1.5" fill="currentColor" />
            <circle cx="550" cy="400" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="550" cy="400" r="1.5" fill="currentColor" />
            <circle cx="410" cy="420" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="410" cy="420" r="2" fill="currentColor" />
            <circle cx="115" cy="430" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="115" cy="430" r="1.5" fill="currentColor" />
            <circle cx="120" cy="430" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="120" cy="430" r="1.5" fill="currentColor" />
            <circle cx="130" cy="540" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="130" cy="540" r="1.5" fill="currentColor" />
            <circle cx="118" cy="550" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="118" cy="550" r="1.5" fill="currentColor" />
            <circle cx="8" cy="530" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="530" r="1.5" fill="currentColor" />

            {/* ================================================
                POWER REGULATOR — SOT-23 footprint
                ================================================ */}
            <rect x="80" y="370" width="10" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="80" y="384" width="10" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="100" y="377" width="10" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M80,374 L60,374 L40,354 L40,320" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M110,381 L140,381 L158,363 L158,320" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M158,320 L158,280 L180,258" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M40,320 L40,290" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* ================================================
                LED + RESISTOR — bottom area
                ================================================ */}
            <rect x="440" y="380" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="466" y="380" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M408,380 L426,380 L438,386" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M484,386 L500,386 L520,366" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                EDGE-CROSSING STUBS — seamless tiling
                ================================================ */}
            <path d="M0,100 L40,100 L55,115" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M555,115 L570,100 L600,100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M585,54 L600,39" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M0,39 L15,54" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M588,66 L600,54" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M0,54 L12,66" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M0,453 L10,443" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M590,443 L600,453" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M0,460 L8,452" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M592,452 L600,460" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M0,513 L8,521" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M592,521 L600,513" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M158,0 L158,30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M158,570 L158,600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M520,366 L540,346 L540,300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* ================================================
                CONNECTING TRACES — filling sparse areas
                ================================================ */}
            {/* Chip #1 to chip #3 — UART bus */}
            <path d="M430,89 L400,89 L380,69 L340,69" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M430,101 L405,101 L385,121 L385,145 L370,160" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

            {/* Power rail across top — 4px */}
            <path d="M462,40 L400,40 L380,60 L348,60" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />

            {/* Chip #1 to chip #2 — SPI connection through vias */}
            <path d="M340,334 L360,334 L380,354 L380,390" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* Ground trace cluster in center-right */}
            <path d="M540,300 L540,350 L520,370" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Additional standalone vias */}
            <circle cx="55" cy="115" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="55" cy="115" r="1.5" fill="currentColor" />
            <circle cx="40" cy="290" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="40" cy="290" r="2" fill="currentColor" />
            <circle cx="340" cy="69" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="340" cy="69" r="1.5" fill="currentColor" />
            <circle cx="348" cy="60" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="348" cy="60" r="2" fill="currentColor" />
            <circle cx="370" cy="160" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="370" cy="160" r="1.5" fill="currentColor" />
            <circle cx="558" cy="430" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="558" cy="430" r="1.5" fill="currentColor" />
            <circle cx="520" cy="370" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="520" cy="370" r="2" fill="currentColor" />
            <circle cx="380" cy="390" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="380" cy="390" r="2" fill="currentColor" />

            {/* Bottom-center filler traces */}
            <path d="M200,480 L250,480 L280,510 L280,545" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M314,549 L350,549 L370,529 L370,490" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="200" cy="480" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="200" cy="480" r="1.5" fill="currentColor" />
            <circle cx="370" cy="490" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="370" cy="490" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pcb-traces)" />
      </svg>
    </div>
  );
}
