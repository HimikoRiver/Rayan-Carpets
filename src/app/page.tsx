"use client";

import dynamic from "next/dynamic";

const ShowroomScene = dynamic(
  () => import("@/components/home/ShowroomScene"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-label="Загрузка выставочного зала"
        style={{
          height: "100svh",
          background: "#130C0E",
        }}
      />
    ),
  },
);

export default function Home() {
  return <ShowroomScene />;
}