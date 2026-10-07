/**
 * Meta (Facebook/Instagram) Pixel base snippet. Loads only when
 * NEXT_PUBLIC_META_PIXEL_ID is set, so it's safe to deploy before the Pixel
 * exists and never runs in local/dev. Fires PageView on load; conversion
 * events (Quote, Lead) are fired from the print funnel via lib/metapixel.ts.
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  if (!PIXEL_ID) return null;

  const snippet = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`;

  return (
    <>
      <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: snippet }} />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element -- Meta's required 1x1 tracking beacon, not a real image */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
