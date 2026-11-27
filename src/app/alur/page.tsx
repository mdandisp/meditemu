import type { Metadata } from "next";
import FlowExplorer from "@/components/FlowExplorer";

export const metadata: Metadata = {
  title: "Alur 8 Langkah | MediTemu",
  description: "Arsitektur alur 8 langkah pengguna masyarakat awam dan verifikasi dosen penguji pada MediTemu."
};

export default function AlurPage() {
  return <FlowExplorer />;
}
