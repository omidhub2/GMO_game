import { notFound } from "next/navigation";
import HomePage from "../page";

export default async function LocalizedHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale === "fa") return <HomePage />;
  if (locale === "en") return <div lang="en" dir="ltr"><HomePage /></div>;
  notFound();
}
