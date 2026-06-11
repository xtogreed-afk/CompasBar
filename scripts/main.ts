import * as mc from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";

const THRESHOLD: number = 0.5;

interface VoteSession {
    sleeperName: string;
    votes: Map<string, boolean>;
    players: mc.Player[];
}

let session: VoteSession | undefined = undefined;

function checkVotes(s: VoteSession): void {
    if (s.votes.size < s.players.length) return;

    const yes: number = [...s.votes.values()].filter((v: boolean) => v).length;
    const total: number = s.votes.size;
    const needed: number = Math.ceil(total * THRESHOLD);

    if (yes >= needed) {
        mc.world.setTimeOfDay(1000);
        mc.world.sendMessage(`SleepVote: Night skipped! (${yes}/${total})`);
    } else {
        mc.world.sendMessage(`SleepVote: Vote failed. (${yes}/${total})`);
    }
    session = undefined;
}

async function showForm(player: mc.Player, sleeperName: string): Promise<void> {
    const form: ActionFormData = new ActionFormData()
        .title("SleepVote")
        .body(`${sleeperName} wants to skip the night. Vote!`)
        .button("Yes")
        .button("No");

    const result: ActionFormResponse = await form.show(player);
    if (!session) return;

    session.votes.set(player.id, !result.canceled && result.selection === 0);
    checkVotes(session);
}

mc.world.afterEvents.entitySleep.subscribe((event: mc.EntitySleepAfterEvent) => {
    if (!(event.entity instanceof mc.Player)) return;
    if (session !== undefined) return;

    const sleeper: mc.Player = event.entity as mc.Player;
    const players: mc.Player[] = [...mc.world.getPlayers()];

    session = {
        sleeperName: sleeper.name,
        votes: new Map<string, boolean>(),
        players
    };

    mc.world.sendMessage(`SleepVote: ${sleeper.name} wants to skip the night!`);
    for (const player of players) showForm(player, sleeper.name);
});
