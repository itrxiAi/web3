import { NextResponse } from "next/server";
import {
  getEquityBasePriceDisplay,
  getEquityBasePriceTransfer,
  getEquityPlusPriceDisplay,
  getEquityPlusPriceTransfer,
  getEquityPremiumPriceDisplay,
  getEquityPremiumPriceTransfer,
} from "@/lib/config";
import { EQUITY_BASE_TYPE, EQUITY_PLUS_TYPE, EQUITY_PREMIUM_TYPE } from "@/constants";

export async function POST() {
  try {
    const [baseD, plusD, premD, baseT, plusT, premT] = await Promise.all([
      getEquityBasePriceDisplay(),
      getEquityPlusPriceDisplay(),
      getEquityPremiumPriceDisplay(),
      getEquityBasePriceTransfer(),
      getEquityPlusPriceTransfer(),
      getEquityPremiumPriceTransfer(),
    ]);

    return NextResponse.json({
      tiers: [
        {
          dev_type: EQUITY_BASE_TYPE,
          price_display: baseD.toString(),
          price_transfer: baseT.toFixed(0),
        },
        {
          dev_type: EQUITY_PLUS_TYPE,
          price_display: plusD.toString(),
          price_transfer: plusT.toFixed(0),
        },
        {
          dev_type: EQUITY_PREMIUM_TYPE,
          price_display: premD.toString(),
          price_transfer: premT.toFixed(0),
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching equity info:", error);
    return NextResponse.json({ error: "Failed to fetch equity info" }, { status: 500 });
  }
}
