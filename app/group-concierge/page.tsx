import { redirect } from "next/navigation";

export default function GroupConciergeRedirect() {
  redirect("/console?mode=community");
}
