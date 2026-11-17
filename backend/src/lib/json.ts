// toJSON options for every model: expose `id`, hide `_id` and `__v`.
export const jsonOpts = {
  virtuals: true,
  versionKey: false as const,
  transform(_doc: unknown, ret: Record<string, unknown>) {
    delete ret._id;
    return ret;
  },
};
