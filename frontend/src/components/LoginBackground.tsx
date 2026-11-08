// Settings from the user's Toolcraft website export. Keep the initial flow clock
// so the login opens on the chosen formation rather than a new random scene.
const preset = {
  values: {
    'field.count': 16000,
    'field.cluster': 166,
    'field.seed': 4294,
    'field.wave': 45,
    'field.attraction': 3,
    'field.reconnect': 31,
    'field.turbulence': 54,
    'field.speed': 2.806,
    'field.rippleStrength': 23,
    'field.rippleRadius': 350,
    'field.grain': 40,
    'field.grainSize': 0.6,
    'field.size': 4.3,
    'field.depth': 55,
    'field.brightness': 100,
    'field.palette': 'custom',
    'field.orientation': {
      position: [-1.4141877033521078, 3.6922767031294113, -3.0605826058473555],
      up: [-0.309746630419028, -0.6743023875837234, -0.670353127122525],
    },
    'field.pointerRipples': true,
    'field.color1': '#BDE5E0',
    'field.color2': '#034D91',
    'field.color3': '#B9A3FF',
    'field.color4': '#C90331',
    'field.color5': '#F4C579',
    'field.color6': '#0BB7AC',
    'export.includeBackground': false,
    'appearance.background': '#F9FAF5',
    'field.flowClock': { elapsed: 2385.521999199871, cursor: 0, interactionTime: 0 },
  },
  width: 3556,
  height: 2000,
};

const source = `${import.meta.env.BASE_URL}login-fluid/index.html#${encodeURIComponent(JSON.stringify(preset))}`;

export default function LoginBackground() {
  return (
    <iframe
      className="login-fluid-background"
      src={source}
      title="Fluid animation"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
