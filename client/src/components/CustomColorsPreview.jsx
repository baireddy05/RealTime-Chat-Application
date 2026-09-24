// Standalone live studio preview for the Custom Colors editor.
// Painted purely with theme CSS variables, so every pick shows exactly where
// it lands in the real UI the moment it is made. Sections mirror
// CUSTOM_COLOR_GROUPS 1:1 — backgrounds, text, both bubble sets, accents,
// presence, panels & overlays, borders, pills, sender colors — so every
// customizable element has a visible preview.
const T = (v) => `var(${v})`;
const R = (v) => `rgb(var(${v}))`;

const MiniRail = () => (
  <div
    className="w-10 shrink-0 flex flex-col items-center py-2 gap-2"
    style={{ background: R("--bg-rail-rgb"), borderRight: `1px solid ${T("--glass-divider")}` }}
  >
    <span className="w-6 h-6 rounded-lg" style={{ background: R("--accent-primary-rgb") }} />
    <span className="w-6 h-6 rounded-lg" style={{ background: T("--pill-active-bg") }} />
    {[R("--text-muted-rgb"), R("--text-muted-rgb"), R("--txt-dim-rgb")].map((c, i) => (
      <span key={i} className="w-5 h-5 rounded-lg" style={{ background: c, opacity: 0.7 }} />
    ))}
  </div>
);

const MiniSidebar = () => (
  <div className="w-[38%] shrink-0 flex flex-col min-w-0" style={{ background: R("--bg-sidebar-rgb") }}>
    <div className="px-2 pt-2">
      <div
        className="rounded-full px-2 py-1 text-[8px]"
        style={{ background: T("--glass-input"), color: R("--text-muted-rgb"), border: `1px solid ${T("--glass-border")}` }}
      >
        Search...
      </div>
    </div>
    <div className="p-1.5 space-y-1">
      {[
        { name: "Ava", sub: "Hey, colors?", on: true, unread: 3, active: true },
        { name: "Leo", sub: "Looks good", on: false, unread: 0, active: false },
      ].map((c) => (
        <div
          key={c.name}
          className="flex items-center gap-1.5 p-1.5 rounded-xl"
          style={c.active ? { background: T("--pill-active-bg") } : undefined}
        >
          <span className="relative w-6 h-6 rounded-full shrink-0" style={{ background: R("--bg-surface-bright-rgb") }}>
            <span
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1"
              style={{
                background: c.on ? R("--status-online-rgb") : R("--status-offline-rgb"),
                ["--tw-ring-color"]: R("--bg-sidebar-rgb"),
              }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-[9px] font-bold truncate"
              style={{ color: c.active ? T("--pill-active-text") : R("--text-main-rgb") }}
            >
              {c.name}
            </span>
            <span
              className="block text-[8px] truncate"
              style={{ color: c.active ? T("--pill-active-text") : R("--text-muted-rgb"), opacity: c.active ? 0.8 : 1 }}
            >
              {c.sub}
            </span>
          </span>
          {c.unread > 0 && (
            <span
              className="text-[8px] font-bold px-1.5 py-px rounded-full shrink-0"
              style={{ background: R("--accent-primary-rgb"), color: "#fff" }}
            >
              {c.unread}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);

const MiniChat = () => (
  <div className="flex-1 flex flex-col min-w-0" style={{ background: R("--bg-chat-rgb") }}>
    <div
      className="flex items-center gap-1.5 px-2 py-1.5"
      style={{ background: T("--glass-header"), borderBottom: `1px solid ${T("--glass-divider")}` }}
    >
      <span className="relative w-5 h-5 rounded-full shrink-0" style={{ background: R("--bg-surface-bright-rgb") }}>
        <span
          className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full"
          style={{ background: R("--status-online-rgb") }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-bold truncate" style={{ color: R("--text-main-rgb") }}>
          Preview chat
        </span>
        <span className="block text-[8px]" style={{ color: R("--text-muted-rgb") }}>
          online
        </span>
      </span>
      <span
        className="ml-auto text-[8px] font-bold px-1.5 py-px rounded-full"
        style={{ background: R("--accent-primary-rgb"), color: "#fff" }}
      >
        3
      </span>
    </div>
    <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
      <div className="flex justify-start">
        <div
          className="max-w-[90%] px-2 py-1 rounded-xl rounded-tl-sm"
          style={{
            background: T("--bubble-incoming-surface"),
            color: R("--bubble-incoming-text"),
            border: `1px solid ${T("--bubble-incoming-border")}`,
            fontSize: 9,
          }}
        >
          <span className="block font-bold" style={{ color: T("--sender-2"), fontSize: 8 }}>
            Ava
          </span>
          Hey, do the new colors look right?
          <span className="flex justify-end items-center gap-0.5 opacity-70" style={{ fontSize: 8 }}>
            <span style={{ color: R("--bubble-incoming-subtext") }}>10:42</span>
            <span style={{ color: R("--bubble-incoming-ticks") }}>✓✓</span>
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <div
          className="max-w-[90%] px-2 py-1 rounded-xl rounded-tr-sm"
          style={{
            background: T("--bubble-outgoing-gradient"),
            color: R("--bubble-outgoing-text"),
            border: `1px solid ${T("--bubble-outgoing-border")}`,
            fontSize: 9,
          }}
        >
          Perfect match!
          <span className="flex justify-end items-center gap-0.5 opacity-80" style={{ fontSize: 8 }}>
            <span style={{ color: R("--bubble-outgoing-subtext") }}>10:43</span>
            <span className="font-bold" style={{ color: R("--bubble-outgoing-ticks") }}>
              ✓✓
            </span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <span
          className="text-[8px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: R("--accent-primary-rgb"), color: "#fff" }}
        >
          Accent button
        </span>
        <span className="text-[8px]" style={{ color: R("--text-muted-rgb") }}>
          Muted hint text
        </span>
      </div>
    </div>
    <div className="p-1.5">
      <div
        className="rounded-full px-2 py-1"
        style={{
          background: T("--glass-input"),
          color: R("--text-muted-rgb"),
          border: `1px solid ${T("--glass-border")}`,
          fontSize: 8,
        }}
      >
        Type a message...
      </div>
    </div>
  </div>
);

const KitPanel = ({ label, children }) => (
  <div
    className="rounded-2xl p-2.5 space-y-1.5"
    style={{ background: T("--glass-panel"), border: `1px solid ${T("--glass-border")}` }}
  >
    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: R("--text-muted-rgb") }}>
      {label}
    </p>
    {children}
  </div>
);

const BgTile = ({ color, label }) => (
  <div className="flex items-center gap-1.5 min-w-0">
    <span
      className="w-6 h-6 rounded-lg shrink-0 border"
      style={{ background: color, borderColor: T("--glass-border") }}
    />
    <span className="text-[8px] font-semibold truncate" style={{ color: R("--text-muted-rgb") }}>
      {label}
    </span>
  </div>
);

export default function CustomColorsPreview() {
  return (
    <div className="space-y-2.5">
      {/* Mini 3-zone app mock: rail + sidebar + chat */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: R("--bg-app-rgb"), border: `1px solid ${T("--glass-border")}` }}
      >
        <div className="flex" style={{ height: 300 }}>
          <MiniRail />
          <MiniSidebar />
          <MiniChat />
        </div>
      </div>

      {/* Backgrounds — all 9 bg-* vars */}
      <KitPanel label="Backgrounds">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <BgTile color={R("--bg-app-rgb")} label="App" />
          <BgTile color={R("--bg-rail-rgb")} label="Activity rail" />
          <BgTile color={R("--bg-sidebar-rgb")} label="Chats sidebar" />
          <BgTile color={R("--bg-chat-rgb")} label="Chat area" />
          <BgTile color={R("--bg-surface-rgb")} label="Cards / surfaces" />
          <BgTile color={R("--bg-surface-bright-rgb")} label="Raised surfaces" />
          <BgTile color={R("--bg-card-rgb")} label="Menu cards" />
          <BgTile color={R("--bg-card-hover-rgb")} label="Menu hover" />
          <BgTile color={R("--bg-input-rgb")} label="Input fields" />
        </div>
        <div className="flex gap-1.5 pt-1">
          <div className="flex-1 rounded-xl p-2" style={{ background: R("--bg-card-rgb"), border: `1px solid ${T("--glass-border")}` }}>
            <p className="text-[8px] font-bold" style={{ color: R("--text-main-rgb") }}>Menu card</p>
            <p className="text-[8px]" style={{ color: R("--text-muted-rgb") }}>default state</p>
          </div>
          <div className="flex-1 rounded-xl p-2" style={{ background: R("--bg-card-hover-rgb"), border: `1px solid ${T("--glass-border")}` }}>
            <p className="text-[8px] font-bold" style={{ color: R("--text-main-rgb") }}>Menu card</p>
            <p className="text-[8px]" style={{ color: R("--text-muted-rgb") }}>hover state</p>
          </div>
        </div>
        <div
          className="rounded-xl px-2 py-1.5 text-[8px]"
          style={{ background: R("--bg-input-rgb"), color: R("--text-muted-rgb"), border: `1px solid ${T("--glass-border")}` }}
        >
          Input field background — search boxes, forms
        </div>
      </KitPanel>

      {/* Text ramp — all 6 text vars */}
      <KitPanel label="Text">
        <p className="text-[11px] font-bold" style={{ color: R("--text-main-rgb") }}>Primary text Aa</p>
        <p className="text-[11px]" style={{ color: R("--txt-secondary-rgb") }}>Secondary text Aa</p>
        <p className="text-[11px]" style={{ color: R("--text-muted-rgb") }}>Muted text Aa</p>
        <p className="text-[11px]" style={{ color: R("--txt-primary-rgb") }}>Body text Aa</p>
        <p className="text-[11px]" style={{ color: R("--txt-muted-rgb") }}>Faint text Aa</p>
        <p className="text-[11px]" style={{ color: R("--txt-dim-rgb") }}>Dim hint Aa</p>
      </KitPanel>

      {/* Message bubbles — both sets, full detail */}
      <KitPanel label="Message bubbles">
        <div className="flex justify-start">
          <div
            className="max-w-[92%] px-2 py-1 rounded-xl rounded-tl-sm"
            style={{
              background: T("--bubble-incoming-surface"),
              color: R("--bubble-incoming-text"),
              border: `1px solid ${T("--bubble-incoming-border")}`,
              fontSize: 9,
            }}
          >
            <span className="block font-bold" style={{ color: T("--sender-3"), fontSize: 8 }}>Maya</span>
            Their bubble — border, text, time
            <span className="flex justify-end items-center gap-0.5" style={{ fontSize: 8 }}>
              <span style={{ color: R("--bubble-incoming-subtext") }}>10:42</span>
              <span style={{ color: R("--bubble-incoming-ticks") }}>✓✓</span>
            </span>
          </div>
        </div>
        <div className="flex justify-end">
          <div
            className="max-w-[92%] px-2 py-1 rounded-xl rounded-tr-sm"
            style={{
              background: T("--bubble-outgoing-gradient"),
              color: R("--bubble-outgoing-text"),
              border: `1px solid ${T("--bubble-outgoing-border")}`,
              fontSize: 9,
            }}
          >
            My bubble — border, text, time
            <span className="flex justify-end items-center gap-0.5" style={{ fontSize: 8 }}>
              <span style={{ color: R("--bubble-outgoing-subtext") }}>10:43</span>
              <span className="font-bold" style={{ color: R("--bubble-outgoing-ticks") }}>✓✓</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span
            className="w-5 h-5 rounded-md shrink-0 border"
            title="Outgoing bubble color"
            style={{ background: T("--bubble-outgoing-bg"), borderColor: T("--bubble-outgoing-border") }}
          />
          <span
            className="w-5 h-5 rounded-md shrink-0 border"
            title="Incoming bubble color"
            style={{ background: T("--bubble-incoming-bg"), borderColor: T("--bubble-incoming-border") }}
          />
          <span className="text-[8px]" style={{ color: R("--text-muted-rgb") }}>
            Bubble fill + border swatches, ticks in both states
          </span>
        </div>
      </KitPanel>

      {/* Presence */}
      <KitPanel label="Presence">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="relative w-6 h-6 rounded-full" style={{ background: R("--bg-surface-bright-rgb") }}>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2" style={{ background: R("--status-online-rgb") }} />
            </span>
            <span className="text-[9px] font-semibold" style={{ color: R("--text-main-rgb") }}>Online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative w-6 h-6 rounded-full" style={{ background: R("--bg-surface-bright-rgb") }}>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2" style={{ background: R("--status-offline-rgb") }} />
            </span>
            <span className="text-[9px] font-semibold" style={{ color: R("--text-muted-rgb") }}>Offline</span>
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: R("--status-online-rgb"), color: R("--bg-app-rgb") }}>
            ●
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: R("--status-offline-rgb"), color: R("--bg-app-rgb") }}>
            ●
          </span>
        </div>
      </KitPanel>

      {/* Pills & sender colors */}
      <KitPanel label="Pills, badges & sender colors">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[9px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: T("--pill-active-bg"), color: T("--pill-active-text"), border: `1px solid ${T("--pill-active-border")}` }}
          >
            All
          </span>
          <span
            className="text-[9px] font-semibold px-2.5 py-1 rounded-full"
            style={{ color: R("--text-muted-rgb"), border: `1px solid ${T("--glass-border")}` }}
          >
            Unread
          </span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: R("--accent-primary-rgb") }}
          >
            3
          </span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: R("--accent-secondary-rgb") }}
          >
            12
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5 items-center">
          {[
            { n: 1, name: "Ava" },
            { n: 2, name: "Leo" },
            { n: 3, name: "Maya" },
            { n: 4, name: "Rio" },
            { n: 5, name: "Zoe" },
            { n: 6, name: "Kai" },
          ].map(({ n, name }) => (
            <span key={n} className="text-[10px] font-bold" style={{ color: `var(--sender-${n})` }}>
              {name}
            </span>
          ))}
        </div>
      </KitPanel>

      {/* Accents, washes & dividers */}
      <KitPanel label="Accents, washes & dividers">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: R("--accent-primary-rgb") }}>
            Primary
          </span>
          <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: R("--accent-secondary-rgb") }}>
            Secondary
          </span>
          <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: R("--accent-emerald-rgb") }}>
            Emerald
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-2 py-1 rounded-lg" style={{ background: T("--glass-hover"), color: R("--text-muted-rgb") }}>
            hover wash
          </span>
          <span className="text-[9px] px-2 py-1 rounded-lg" style={{ background: T("--glass-active"), color: R("--text-muted-rgb") }}>
            pressed wash
          </span>
          <span className="text-[9px] px-2 py-1 rounded-lg" style={{ background: T("--glass-surface"), color: R("--text-muted-rgb"), border: `1px solid ${T("--glass-border")}` }}>
            glass surface
          </span>
        </div>
        <div style={{ borderTop: `1px solid ${T("--glass-divider")}` }} className="pt-1.5">
          <span className="text-[9px]" style={{ color: R("--text-muted-rgb") }}>
            Divider line above — borders & dividers
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 rounded-lg p-1.5 text-center text-[8px] font-bold" style={{ border: `1.5px solid ${T("--glass-border")}`, color: R("--text-muted-rgb") }}>
            Glass border
          </div>
          <div className="flex-1 rounded-lg p-1.5 text-center text-[8px] font-bold" style={{ background: T("--glass-divider"), color: R("--text-muted-rgb") }}>
            Divider fill
          </div>
        </div>
      </KitPanel>

      {/* Panels & overlays — all 10 glass/modal vars */}
      <KitPanel label="Panels & overlays">
        <div className="space-y-1.5">
          <div className="rounded-xl px-2 py-1.5 text-[8px] font-bold" style={{ background: T("--glass-sidebar"), border: `1px solid ${T("--glass-border")}`, color: R("--text-main-rgb") }}>
            Sidebar panel
          </div>
          <div className="rounded-xl px-2 py-1.5 text-[8px] font-bold" style={{ background: T("--glass-chat"), border: `1px solid ${T("--glass-border")}`, color: R("--text-main-rgb") }}>
            Chat panel
          </div>
          <div className="rounded-xl px-2 py-1.5 text-[8px] font-bold" style={{ background: T("--glass-header"), border: `1px solid ${T("--glass-border")}`, color: R("--text-main-rgb") }}>
            Header bar
          </div>
          <div className="rounded-xl px-2 py-1.5" style={{ background: T("--glass-heavy"), border: `1px solid ${T("--glass-border")}` }}>
            <p className="text-[8px] font-bold" style={{ color: R("--text-main-rgb") }}>Modal / heavy overlay</p>
            <p className="text-[8px]" style={{ color: R("--text-muted-rgb") }}>dialogs, popovers</p>
          </div>
          <div className="rounded-full px-2 py-1 text-[8px]" style={{ background: T("--glass-input"), border: `1px solid ${T("--glass-border")}`, color: R("--text-muted-rgb") }}>
            Input pill — Type a message...
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T("--glass-border")}` }}>
            <div className="px-2 py-1 text-[8px] font-bold" style={{ background: T("--modal-backdrop"), color: "#fff" }}>
              Backdrop dim — behind dialogs
            </div>
          </div>
        </div>
      </KitPanel>
    </div>
  );
}
