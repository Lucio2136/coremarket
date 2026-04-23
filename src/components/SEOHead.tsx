import { Helmet } from "react-helmet-async";

const BASE_URL = "https://www.lucebase.com";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = "Lucebase";

interface SEOHeadProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

export function SEOHead({
  title,
  description = "Predice lo que figuras públicas dirán o harán. Mercados de predicción en tiempo real con pesos mexicanos.",
  url,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Mercados de Predicción en México`;
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="es_MX" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
