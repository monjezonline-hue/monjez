import { prisma } from "../../../lib/prisma";

export async function GET() {
  const errors = await prisma.errorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json(errors);
}