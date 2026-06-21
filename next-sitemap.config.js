const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.nabatable.com';

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  // use this to exclude routes from the sitemap (i.e. a user dashboard). By default, NextJS app router metadata files are excluded (https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
  // `/dev/*` routes are dev-only harness pages guarded by server-side `notFound()` and should never be indexed.
  exclude: ['/twitter-image.*', '/opengraph-image.*', '/icon.*', '/dev', '/dev/*', '/dev/**'],
};
