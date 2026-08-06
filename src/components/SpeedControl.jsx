import { setSpeed as postSpeed } from "../useSimState";

export default function SpeedControl({ speed, setSpeed, session = "default" }) {
  const options = [1, 5, 20];
  const changeSpeed = (mult) => {
    setSpeed(mult);
    postSpeed(mult, session).catch(() => {});
  };
  return (
    <div className="flex gap-2">
      {options.map((mult) => (
        <button
          key={mult}
          onClick={() => changeSpeed(mult)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            speed === mult ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {mult}x
        </button>
      ))}
    </div>
  );
}
