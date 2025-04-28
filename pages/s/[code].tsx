import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { code } = context.params || {};

  if (!code || typeof code !== 'string') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  try {
    // Find the short URL record using raw SQL
    const shortUrls = await prisma.$queryRaw`
      SELECT * FROM "ShortUrl" 
      WHERE "shortCode" = ${code}
      LIMIT 1
    `;

    const shortUrl = (shortUrls as any[])[0];

    if (!shortUrl) {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }

    // Update the access count
    await prisma.$executeRaw`
      UPDATE "ShortUrl" 
      SET "accessCount" = "accessCount" + 1 
      WHERE "id" = ${shortUrl.id}
    `;

    // Redirect to the original URL
    return {
      redirect: {
        destination: shortUrl.originalUrl,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('Error processing short URL redirect:', error);
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
};

// This component will never be rendered since we always redirect
export default function ShortURLRedirect() {
  return null;
}
