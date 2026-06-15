import * as Icons from "@heroicons/react/24/outline";

export default function IconGallery() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "20px" }}>
      {Object.entries(Icons).map(([name, Icon]) => (
        <div key={name} style={{ textAlign: "center" }}>
          <Icon style={{ width: 40, height: 40 }} />
          <p style={{ fontSize: "12px" }}>{name}</p>
        </div>
      ))}
    </div>
  );
}
