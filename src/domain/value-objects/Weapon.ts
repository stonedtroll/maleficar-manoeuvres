export interface WeaponRange {
    melee?: number;
    minimum?: number;
    effective?: { min: number; max: number };
    maximum?: number;
    units?: string;
}

export class Weapon {
    private readonly _name: string;
    private readonly _image: string;
    private readonly _range: WeaponRange;
    private readonly _isEquipped: boolean;

    constructor(
        name: string,
        image: string,
        range: WeaponRange,
        isEquipped: boolean
    ) {
        this._name = name.trim();
        this._image = image.trim();
        this._range = Object.freeze({ ...range });
        this._isEquipped = isEquipped;
    }

    get name(): string {
        return this._name;
    }

    get image(): string {
        return this._image;
    }

    get range(): WeaponRange {
        return this._range;
    }

    get isEquipped(): boolean {
        return this._isEquipped;
    }

    isWithinRange(distance: number): boolean {
        if (distance <= 0) return true;

        const maxRange = Math.max(
            this._range.melee ?? 0,
            this._range.effective?.max ?? 0,
            this._range.maximum ?? 0
        );

        return distance <= maxRange && distance >= (this._range.minimum ?? 0);
    }

    isWithinEffectiveRange(distance: number): boolean {
        if (distance <= 0 && distance >= (this._range.minimum ?? 0)) return true;

        const effectiveRange = this._range.effective;
        if (!effectiveRange) return false;

        return distance >= effectiveRange.min && distance <= effectiveRange.max;
    }
}