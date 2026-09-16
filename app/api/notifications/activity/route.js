import { userDatabase } from "@/lib/shop-finder/server";
import { paymentDatabase } from "@/lib/shop/supabase-server";
import { createNotification } from "@/lib/notifications/createNotification";

export async function POST(request) {
  try {
    const session = await userDatabase(request);
    if (!session) return Response.json({error:"Sign in first."},{status:401});
    const {type, postId, commentId} = await request.json();
    if (!["likes","comments"].includes(type) || !/^[0-9a-f-]{36}$/i.test(postId || "")) return Response.json({error:"Invalid activity."},{status:400});
    let query = session.db.from(type).select("id").eq("post_id",postId).eq("user_id",session.user.id);
    if (type === "comments") query = query.eq("id",commentId);
    const {data:activity,error} = await query.maybeSingle();
    if (error || !activity) return Response.json({error:"Activity not found."},{status:404});
    const admin = paymentDatabase();
    const {data:post} = await admin.from("posts").select("user_id,created_by,status").eq("id",postId).single();
    const recipient = post?.user_id || post?.created_by;
    if (!recipient || post.status !== "approved" || recipient === session.user.id) return Response.json({success:true});
    const message = type === "likes" ? "Someone liked your build." : "Someone commented on your build.";
    await createNotification({supabaseAdmin:admin,userId:recipient,postId,type,preferenceKey:type,message,
      eventKey: type === "likes" ? `like:${postId}:${session.user.id}` : `comment:${activity.id}`,
      smsBody:`DGD: ${message} https://www.dropgeardisappear.us/build/${postId} Reply STOP to unsubscribe.`});
    return Response.json({success:true});
  } catch (error) {
    console.error("Activity notification failed",error?.name);
    return Response.json({error:"Notification could not be sent."},{status:500});
  }
}
