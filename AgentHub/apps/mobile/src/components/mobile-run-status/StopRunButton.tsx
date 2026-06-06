interface Props {
  onClick: () => void;
}

export function StopRunButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white flex-shrink-0 active:bg-red-600 touch-target"
    >
      ■
    </button>
  );
}
