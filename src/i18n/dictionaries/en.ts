import type he from "./he";

/**
 * English copy, written natively rather than translated literally — the Hebrew
 * marketing voice doesn't survive a word-for-word crossing.
 *
 * Typed `typeof he`: a key added to Hebrew and missed here fails the build. That
 * type annotation is the only thing preventing a half-translated site, so do not
 * loosen it.
 */
const en: typeof he = {
  meta: {
    title: "DentalCompare – Compare dental quotes. Save thousands.",
    description:
      "Get quotes from leading dental clinics with one request, free. Upload your treatment plan once — no phone calls, no pressure.",
    ogTitle: "DentalCompare – Compare dental quotes. Save thousands.",
    ogDescription:
      "Get quotes from 3 dental clinics with a single request, free — no phone calls, no pressure.",
  },
};

export default en;
