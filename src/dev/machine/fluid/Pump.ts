
BlockRegistry.createBlock("pump", [
	{name: "Pump", texture: [["pump_bottom", 0], ["machine_top", 0], ["machine_side", 0], ["pump_front", 0], ["pump_side", 0], ["pump_side", 0]], inCreative: true}
], "machine");
ToolAPI.registerBlockMaterial(BlockID.pump, "stone", 1, true);

TileRenderer.setStandardModelWithRotation(BlockID.pump, 2, [["pump_bottom", 0], ["machine_top", 0], ["machine_side", 0], ["pump_front", 0], ["pump_side", 0], ["pump_side", 0]]);
TileRenderer.registerModelWithRotation(BlockID.pump, 2, [["pump_bottom", 0], ["machine_top", 0], ["machine_side", 0], ["pump_front", 1], ["pump_side", 1], ["pump_side", 1]]);
TileRenderer.setRotationFunction(BlockID.pump);

ItemName.addTierTooltip("pump", 1);

Callback.addCallback("PreLoaded", function() {
	Recipes.addShaped({id: BlockID.pump, count: 1, data: 0}, [
		"cxc",
		"c#c",
		"bab"
	], ['#', BlockID.machineBlockBasic, 0, 'x', ItemID.circuitBasic, 0, 'a', ItemID.treetap, 0, 'b', BlockID.miningPipe, 0, 'c', ItemID.cellEmpty, 0]);
});

const guiPump = MachineRegistry.createInventoryWindow("Pump", {
	drawing: [
		{type: "bitmap", x: 493, y: 149, bitmap: "extractor_bar_background", scale: GUI_SCALE},
		{type: "bitmap", x: 407, y: 127, bitmap: "energy_small_background", scale: GUI_SCALE},
		{type: "bitmap", x: 602, y: 88, bitmap: "liquid_bar", scale: GUI_SCALE},
		{type: "bitmap", x: 675, y: 152, bitmap: "pump_arrow", scale: GUI_SCALE},
	],

	elements: {
		"progressScale": {type: "scale", x: 493, y: 149, direction: 0, bitmap: "extractor_bar_scale", scale: GUI_SCALE},
		"energyScale": {type: "scale", x: 407, y: 127, direction: 1, value: 0.5, bitmap: "energy_small_scale", scale: GUI_SCALE},
		"liquidScale": {type: "scale", x: 400 + 67*GUI_SCALE, y: 50 + 16*GUI_SCALE, direction: 1, bitmap: "gui_water_scale", overlay: "gui_liquid_storage_overlay", scale: GUI_SCALE},
		"slotEnergy": {type: "slot", x: 400, y: 50 + 39*GUI_SCALE},
		"slotLiquid1": {type: "slot", x: 400 + 91*GUI_SCALE, y: 50 + 12*GUI_SCALE},
		"slotLiquid2": {type: "slot", x: 400 + 125*GUI_SCALE, y: 50 + 29*GUI_SCALE},
		"slotUpgrade1": {type: "slot", x: 880, y: 50 + 2*GUI_SCALE},
		"slotUpgrade2": {type: "slot", x: 880, y: 50 + 21*GUI_SCALE},
		"slotUpgrade3": {type: "slot", x: 880, y: 50 + 40*GUI_SCALE},
		"slotUpgrade4": {type: "slot", x: 880, y: 50 + 59*GUI_SCALE},
	}
});

namespace Machine {
	export class Pump extends ElectricMachine {
		liquidTank: BlockEngine.LiquidTank;

		defaultValues = {
			energy: 0,
			progress: 0,
			coords: null
		}

		defaultTier = 1;
		defaultEnergyStorage = 800;
		defaultEnergyDemand = 1;
		defaultProcessTime = 20;
		defaultDrop = BlockID.machineBlockBasic;
		upgrades = ["overclocker", "transformer", "energyStorage", "itemEjector", "itemPulling", "fluidEjector"];

		tier: number;
		energyStorage: number;
		energyDemand: number;
		processTime: number;

		getScreenByName(): UI.IWindow {
			return guiPump;
		}

		getTier(): number {
			return this.tier;
		}

		getEnergyStorage(): number {
			return this.energyStorage;
		}

		setupContainer(): void {
			this.liquidTank = this.addLiquidTank("fluid", 8000);

			StorageInterface.setGlobalValidatePolicy(this.container, (name, id, amount, data) => {
				if (name == "slotLiquid1") return !!LiquidItemRegistry.getFullItem(id, data, "water");
				if (name == "slotLiquid2") return false;
				if (name == "slotEnergy") return ChargeItemRegistry.isValidStorage(id, "Eu", this.getTier());
				return UpgradeAPI.isValidUpgrade(id, this);
			});
		}

		useUpgrades(): void {
			let upgrades = UpgradeAPI.useUpgrades(this);
			this.tier = upgrades.getTier(this.defaultTier);
			this.energyStorage = upgrades.getEnergyStorage(this.defaultEnergyStorage);
			this.energyDemand = upgrades.getEnergyDemand(this.defaultEnergyDemand);
			this.processTime = upgrades.getProcessTime(this.defaultProcessTime);
		}

		onTick(): void {
			this.useUpgrades();
			StorageInterface.checkHoppers(this);

			this.extractLiquid();

			let slot1 = this.container.getSlot("slotLiquid1");
			let slot2 = this.container.getSlot("slotLiquid2");
			this.liquidTank.addLiquidToItem(slot1, slot2);

			this.dischargeSlot("slotEnergy");

			this.liquidTank.updateUiScale("liquidScale");
			this.container.setScale("progressScale", this.data.progress);
			this.container.setScale("energyScale", this.getRelativeEnergy());
			this.container.sendChanges();
		}

		extractLiquid(): void {
			let newActive = false;
			let liquid = this.liquidTank.getLiquidStored();
			if (this.y > 0 && this.liquidTank.getAmount() <= 7000 && this.data.energy >= this.energyDemand) {
				if (this.data.progress == 0) {
					this.data.coords = this.recursiveSearch(liquid, this.x, this.y - 1, this.z, {});
				}
				if (this.data.coords) {
					newActive = true;
					this.data.energy -= this.energyDemand;
					this.data.progress += 1 / this.processTime;
					if (+this.data.progress.toFixed(3) >= 1) {
						let coords = this.data.coords;
						let block = this.region.getBlock(coords);
						liquid = this.getLiquidType(liquid, block);
						if (liquid && block.data == 0) {
							this.region.setBlock(coords, 0, 0);
							this.liquidTank.addLiquid(liquid, 1000);
						}
						this.data.progress = 0;
					}
				}
			}
			else {
				this.data.progress = 0;
			}
			this.setActive(newActive);
		}

		recursiveSearch(liquid: string, x: number, y: number, z: number, map: {}): Vector {
			let block = this.region.getBlock(x, y, z);
			let coordsKey = x+':'+y+':'+z;
			if (!map[coordsKey] && Math.abs(this.x - x) <= 64 && Math.abs(this.z - z) <= 64 && this.getLiquidType(liquid, block)) {
				if (block.data == 0) return new Vector3(x, y, z);
				map[coordsKey] = true;
				return this.recursiveSearch(liquid, x, y+1, z, map) ||
				this.recursiveSearch(liquid, x+1, y, z, map) ||
				this.recursiveSearch(liquid, x-1, y, z, map) ||
				this.recursiveSearch(liquid, x, y, z+1, map) ||
				this.recursiveSearch(liquid, x, y, z-1, map);
			}
			return null;
		}

		getLiquidType(liquid: string, block: Tile): string {
			if ((!liquid || liquid == "water") && (block.id == 8 || block.id == 9)) {
				return "water";
			}
			if ((!liquid || liquid == "lava") && (block.id == 10 || block.id == 11)) {
				return "lava";
			}
			return null;
		}

		getOperationSound(): string {
			return "PumpOp.ogg";
		}

		canRotate(side: number): boolean {
			return side > 1;
		}
	}

	MachineRegistry.registerPrototype(BlockID.pump, new Pump());

	MachineRegistry.createStorageInterface(BlockID.pump, {
		slots: {
			"slotLiquid1": {input: true},
			"slotLiquid2": {output: true}
		},
		isValidInput: (item: ItemInstance) => (
			!!LiquidItemRegistry.getFullItem(item.id, item.data, "water")
		),
		canReceiveLiquid: () => false
	});
}