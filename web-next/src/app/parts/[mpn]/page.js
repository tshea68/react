import SingleProductClient from "../../../components/SingleProductClient";

export default async function Page({ params }) {
  const { mpn } = await params; // REQUIRED for your Next version
  return <SingleProductClient mpn={mpn} mode="parts" />;
}
