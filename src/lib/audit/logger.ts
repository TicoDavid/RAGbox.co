// logger.ts

import { BigQuery } from '@google-cloud/bigquery';

class Logger {
    private bigQuery: BigQuery;
    private datasetId: string;
    private tableId: string;

    constructor(datasetId: string, tableId: string) {
        this.bigQuery = new BigQuery();
        this.datasetId = datasetId;
        this.tableId = tableId;
    }

    async logAuditEvent(event: object) {
        const rows = [event];
        await this.bigQuery
            .dataset(this.datasetId)
            .table(this.tableId)
            .insert(rows);
        console.log('Logged event to BigQuery:', event);
    }
}

export default Logger;

// Usage example (replace datasetId and tableId accordingly):
// const logger = new Logger('your_dataset_id', 'your_table_id');
// logger.logAuditEvent({ user: 'TicoDavid', action: 'some_action', timestamp: new Date().toISOString() });