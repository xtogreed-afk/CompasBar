import * as mc from "@minecraft/server";
import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";

const THRESHOLD: number = 0.5;

interface VoteSession {
    sleeper: mc.Player;
    votes: Map<string, boolean>;
    players: mc.Player[];
}

let session: VoteSession | null = null;

function checkVotes(session: VoteSession): void {
    const { votes, players } = session;
    if (votes.size < players.length) return;

    const yes: number = [...votes.values()].filter((v: boolean) => v).length;
    const total: number = votes.size;
    const needed: number = Math.ceil(total * THRESHOLD);

    if (yes >= needed) {
        mc.world.setTimeOfDay(1000);
        mc.world.sendMessage(`§aSleepVote: Night skipped! (${yes}/${total})`);
    } else {
        mc.world.sendMessage(`§cSleepVote: Vote failed. (${yes}/${total})`);
    }

    session = null;
}

async function showVoteForm(player: mc.Player, sleeperName: string): Promise<void> {
    const form: ActionFormData = new ActionFormData()
        .title("SleepVote")
        .body(`${sleeperName} wants to skip the night. Vote!`)
        .button("Yes ✓")
        .button("No ✗");

    const result: ActionFormResponse = await form.show(player);

    if (session === null) return;

    const voted: boolean = !result.canceled && result.selection === 0;
    session.votes.set(player.id, voted);
    checkVotes(session);
}

mc.world.afterEvents.playerSleep.subscribe((event: mc.PlayerSleepAfterEvent) => {
    if (session !== null) return;

    const sleeper: mc.Player = event.player;
    const players: mc.Player[] = [...mc.world.getPlayers()];

    session = {
        sleeper,
        votes: new Map<string, boolean>(),
        players
    };

    mc.world.sendMessage(`§eSleepVote: ${sleeper.name} wants to skip the night!`);

    for (const player of players) {
        showVoteForm(player, sleeper.name);
    }
});
