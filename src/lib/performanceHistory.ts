import prisma from "./prisma";

// export async function getPerformanceHistory(addresses: string[], year: number, month: number, day: number) {
//   // Get performance history for user and subordinates
//   const performances = await prisma.performance_history.findMany({
//     where: {
//       year,
//       month,
//       day,
//       address: {
//         in: addresses
//       }
//     },
//     select: {
//       address: true,
//       performance: true,
//       token_staked_points: true,
//       token_dynamic_reward: true,
//       subordinates_num: true,
//     }
//   });
//   return performances;
// }