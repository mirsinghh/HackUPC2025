import { auth0 } from "@/lib/auth0";
import "./globals.css";
import { connectToDB } from "@/lib/mongodb";
import User from "@/lib/models/user";
import Group from "@/lib/models/groups";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import Liquid from "@/components/spline/page";
import LoginHome from "@/components/LoginHome/page";
import TypewriterEffect from "@/components/typewriter/page";
import GroupList from "@/components/GroupList";
import Navbar from "@/components/Navbar";

export default async function Home() {
    const session = await auth0.getSession();
    const cookieStore = await cookies();
    const invitedGroupId = cookieStore.get("invitedGroupId")?.value;
    let userGroups: any[] = [];

    if (session) {
        await connectToDB();
        let existingUser = await User.findOne({ auth0Id: session.user.sub });

        if (!existingUser && invitedGroupId) {
            existingUser = await User.create({
                auth0Id: session.user.sub,
                email: session.user.email,
                name: session.user.name,
                groups: [invitedGroupId],
            });
        } else if (existingUser && invitedGroupId) {
            await User.findOneAndUpdate(
                { auth0Id: session.user.sub },
                { $addToSet: { groups: invitedGroupId } }
            );
        }

        if (existingUser?.groups?.length > 0) {
            userGroups = await Group.find({
                groupId: { $in: existingUser.groups },
            });
        }
    }

    async function createGroup(formData: FormData) {
        "use server";
        const name = formData.get("groupName")?.toString();
        if (!name || !session) return;

        await connectToDB();

        const newGroupId = uuidv4();
        await Group.create({
            groupId: newGroupId,
            name,
            createdAt: new Date(),
        });

        await User.findOneAndUpdate(
            { auth0Id: session.user.sub },
            {
                $addToSet: { groups: newGroupId },
                $set: { isOwner: true },
            }
        );

        revalidatePath("/");
        redirect("/");
    }

    return (
        <main className="min-h-screen bg-cover bg-center bg-no-repeat">
            <Navbar session={session} createGroup={createGroup} />

            {!session ? (
                <div>
                    <Liquid />
                    <div className="text-center absolute bottom-10 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <TypewriterEffect />
                    </div>
                </div>
            ) : (
                <div className="absolute top-0 left-0 right-0 bottom-0 mx-16">
                    <div className="mt-36 flex items-center">
                        {session?.user?.picture && (
                            <img
                                src={session.user.picture}
                                alt="Profile"
                                className="w-16 h-16 rounded-full shadow-md"
                            />
                        )}
                        {session?.user?.name && (
                            <h1 className="text-2xl text-[#0f3857] ml-4">
                                <span className="font-bold">Welcome back,</span>{" "}
                                <span className="font-semibold text-[#73d8db]">
                                    {session.user.name}!
                                </span>
                            </h1>
                        )}
                    </div>
                    <h2 className="text-4xl font-bold mt-16 mb-8 text-black">
                        Groups
                    </h2>
                    <GroupList groups={userGroups} />
                </div>
            )}
        </main>
    );
}
