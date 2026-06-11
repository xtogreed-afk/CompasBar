import * as mc from "@minecraft/server";

interface Mark {
    name: string;
    x: number;
    z: number;
    owner: string;
    type: "base" | "danger" | "point";
}

const marks: Mark[] = [];

const COMPASS_WIDTH = 24;
const BASE = "----S----SW---W---NW---N---NE---E---SE---";

function getYaw(player: mc.Player): number {
    const vd = player.getViewDirection();
    let yaw = Math.atan2(vd.x, vd.z) * (180 / Math.PI);
    if (yaw < 0) yaw += 360;
    return yaw;
}

function angleDiff(a: number, b: number): number {
    return ((a - b + 540) % 360) - 180;
}

function markIcon(type: Mark["type"]): string {
    switch (type) {
        case "base":   return "§a⌂§f";
        case "danger": return "§c!§f";
        default:       return "§e▲§f";
    }
}

function buildCompassBar(player: mc.Player): string {
    const yaw = getYaw(player);
    const len = BASE.length;
    const full = BASE + BASE + BASE;
    const center = Math.round((yaw / 360) * len) % len;
    const half = Math.floor(COMPASS_WIDTH / 2);
    const start = (center - half + len * 3) % (len * 3);

    const arr: string[] = [];
    for (let i = 0; i < COMPASS_WIDTH; i++) {
        const ch = full[(start + i) % full.length];
        if (ch === "N") {
            arr.push("§e" + ch + "§f");
        } else {
            arr.push(ch);
        }
    }

    const pos = player.location;
    for (const mark of marks) {
        const dx = mark.x - pos.x;
        const dz = mark.z - pos.z;
        let markYaw = Math.atan2(dx, dz) * (180 / Math.PI);
        if (markYaw < 0) markYaw += 360;
        const diff = angleDiff(markYaw, yaw);
        const posInBar = half + Math.round((diff / 180) * half);
        if (posInBar >= 0 && posInBar < COMPASS_WIDTH) {
            arr[posInBar] = markIcon(mark.type);
        }
    }

    return "§8[§f" + arr.join("") + "§8]";
}

mc.system.runInterval((): void => {
    for (const player of mc.world.getPlayers()) {
        const compass = buildCompassBar(player);
        player.onScreenDisplay.setTitle(compass, {
            fadeInDuration: 0,
            stayDuration: 25,
            fadeOutDuration: 0,
            subtitle: ""
        });
    }
}, 5);

mc.world.afterEvents.chatSend.subscribe((ev: mc.ChatSendAfterEvent): void => {
    const msg = ev.message.trim();
    const player = ev.sender;

    if (msg.startsWith("/mark ")) {
        
        const parts = msg.slice(6).trim().split(" ");
        const name = parts[0];
        const typeRaw = parts[1] ?? "point";
        const type: Mark["type"] =
            typeRaw === "base" ? "base" :
            typeRaw === "danger" ? "danger" : "point";
        if (!name) {
            player.sendMessage("§cИспользование: /mark <название> [base|danger|point]");
            return;
        }
        const loc = player.location;
        const existing = marks.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
        if (existing !== -1) {
            marks[existing] = { name, x: Math.round(loc.x), z: Math.round(loc.z), owner: player.name, type };
            player.sendMessage("§aМетка §e" + name + "§a обновлена.");
        } else {
            marks.push({ name, x: Math.round(loc.x), z: Math.round(loc.z), owner: player.name, type });
            mc.world.sendMessage("§7[§bCompassHUD§7] §e" + player.name + "§7 поставил метку §e" + name);
        }

    } else if (msg === "/marks") {
        
        if (marks.length === 0) {
            player.sendMessage("§7Меток нет.");
            return;
        }
        const loc = player.location;
        let list = "§b── Метки ──\n";
        for (const m of marks) {
            const dx = m.x - loc.x;
            const dz = m.z - loc.z;
            const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
            list += markIcon(m.type) + " §e" + m.name + " §7(" + m.x + ", " + m.z + ") §f" + dist + "м §8[" + m.owner + "]\n";
        }
        player.sendMessage(list.trim());

    } else if (msg.startsWith("/delmark ")) {
        
        const name = msg.slice(9).trim();
        const idx = marks.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
        if (idx === -1) {
            player.sendMessage("§cМетка §e" + name + "§c не найдена.");
            return;
        }
        marks.splice(idx, 1);
        mc.world.sendMessage("§7[§bCompassHUD§7] Метка §e" + name + "§7 удалена.");

    } else if (msg === "/compasshelp") {
        
        player.sendMessage(
            "§b── CompassHUD ──\n" +
            "§e/mark <имя> [base|danger|point]§7 — поставить метку\n" +
            "§e/marks§7 — список меток\n" +
            "§e/delmark <имя>§7 — удалить метку\n" +
            "§7Иконки: §a⌂§7=база §c!§7=опасность §e▲§7=точка"
        );
    }
});
