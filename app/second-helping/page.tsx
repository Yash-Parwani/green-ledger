import { redirect } from "next/navigation";

export default function SecondHelpingRedirect() {
  redirect("/console?mode=csr");
}
