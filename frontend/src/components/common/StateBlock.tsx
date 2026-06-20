export function StateBlock({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "warning" | "error";
}) {
  return (
    <div className={`state-block state-block--${tone}`}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
