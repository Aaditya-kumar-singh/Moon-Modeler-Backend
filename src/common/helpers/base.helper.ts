// Defines a generic interface for a Delegate
// Since Prisma delegates don't share a common base type, we define the shape we expect.
interface Delegate<T> {
    aggregate(args: any): any;
    count(args: any): any;
    create(args: any): any;
    delete(args: any): any;
    deleteMany(args: any): any;
    findFirst(args: any): any;
    findMany(args: any): any;
    findUnique(args: any): any;
    update(args: any): any;
    updateMany(args: any): any;
    upsert(args: any): any;
}

export class BaseHelper<T> {
    constructor(protected model: Delegate<T>) { }

    async addObject(data: any): Promise<T> {
        return this.model.create({ data });
    }

    async getObjectById(id: string | number): Promise<T | null> {
        return this.model.findUnique({
            where: { id } as any,
        });
    }

    async getAllObjects(args: any = {}): Promise<T[]> {
        return this.model.findMany(args);
    }

    async updateObjectById(id: string | number, data: any): Promise<T> {
        return this.model.update({
            where: { id } as any,
            data,
        });
    }

    async deleteObjectById(id: string | number): Promise<T> {
        return this.model.delete({
            where: { id } as any,
        });
    }
}
