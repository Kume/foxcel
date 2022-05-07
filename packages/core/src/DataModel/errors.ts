export class DataModelOperationError {
  constructor(public readonly message: string) {}
}

export class DataSchemaViolationError extends DataModelOperationError {
  constructor(private schema: any, private value: unknown, message?: string) {
    super('');
  }
}
