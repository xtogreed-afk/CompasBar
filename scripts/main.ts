import * as mc from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";

const THRESHOLD: number = 0.5;

interface VoteSession {
    sleeperName: string;
    votes: Map<string, boolean>;
    players: mc.Player[];
}

let session: VoteSession | undefined = undefined;
let sleepingBefore: Set<string> = new Set<string>();

async function showForm(player: mc.Player, sleeperName: string): Promise<void> {
    const form: ActionFormData = new ActionFormData()
        .title("SleepVote")
        .body(`${sleeperName} wants to skip the night. Vote!`)
        .button("Yes")
        .button("No");

    const result: ActionFormResponse = await form.show(player);
    if (!session) return;

    session.votes.set(player.id, !result.canceled && result.selection === 0);

    const yes: number = [...session.votes.values()].filter((v: boolean) => v).length;
    const total: number = session.players.length;
    const needed: number = Math.ceil(total * THRESHOLD);

    if (yes >= needed) {
        mc.world.setTimeOfDay(1000);
        mc.world.sendMessage(`SleepVote: Night skipped! (${yes}/${total})`);
        session = undefined;
    } else if (session.votes.size >= total) {
        mc.world.sendMessage(`SleepVote: Vote failed. (${yes}/${total})`);
        session = undefined;
    }
}

mc.system.runInterval((): void => {
    const players: mc.Player[] = [...mc.world.getPlayers()];
    const nowSleeping: Set<string> = new Set<string>(
        players.filter((p: mc.Player) => p.isSleeping).map((p: mc.Player) => p.id)
    );

    for (const player of players) {
        if (nowSleeping.has(player.id) && !sleepingBefore.has(player.id)) {
            if (session !== undefined) break;
            session = {
                sleeperName: player.name,
                votes: new Map<string, boolean>(),
                players: [...players]
            };
            mc.world.sendMessage(`SleepVote: ${player.name} wants to skip the night!`);
            for (const p of players) showForm(p, player.name);
            break;
        }
    }

    sleepingBefore = nowSleeping;
}, 10);
