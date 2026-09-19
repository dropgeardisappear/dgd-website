import { userDatabase } from "@/lib/shop-finder/server";
import { paymentDatabase } from "@/lib/shop/supabase-server";
import { createNotification } from "@/lib/notifications/createNotification";
export async function POST(request) {
  try {
    const session = await userDatabase(request);
    if (!session) return Response.json({error:"Sign in first."},{status:401});
    const admin = paymentDatabase();
    const {data:preferences} = await admin.from("notification_preferences").select("build_approved,comments,likes,phone_verified").eq("user_id",session.user.id).single();
    const preferenceKey = ["build_approved","comments","likes"].find(key=>preferences?.[key]);
    if (!preferenceKey || !preferences?.phone_verified) return Response.json({error:"Verify your phone and save at least one activity SMS preference first."},{status:400});
    const result = await createNotification({supabaseAdmin:admin,userId:session.user.id,type:"sms_test",message:"SMS test requested.",preferenceKey,
      eventKey:`sms-test:${session.user.id}:${new Date().toISOString().slice(0,10)}`,
      smsBody:"DGD: This is your requested test notification. Your SMS connection is working. Reply STOP to unsubscribe."});
    return Response.json(result.smsSent ? {success:true,message:"Test text accepted by the SMS provider. Check your phone."} : {error:result.smsReason === "Already notified." ? "One test is allowed per day. Check your phone for the earlier test." : result.smsReason},{status:result.smsSent?200:400});
  } catch { return Response.json({error:"The test text could not be sent. Please try again later."},{status:503}); }
}
