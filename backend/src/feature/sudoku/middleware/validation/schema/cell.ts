import { X } from "vitest/dist/chunks/reporters.d.BFLkQcL6.js";
import z from "zod/v4";

export const cellSchema = z.object({
    cellId: z.string(),
    type: z.enum(['prefilled', 'edited', 'blank'], "Invalid cell type"),
    value: z.nullable(z.number('Cell value must be a number')),
    candidates: z.set(z.number('Candidate value must be a number'), 'Invalid candidates set')
})

export const candidateStringSchema = z.string().refine(val => {
    const cells = val.split(':');
    if(cells.length !== 81) {
        return false;
    }
    for(const candidateStr of cells) {
        if(candidateStr.length === 0) {
            continue;
        }
        const res = z.string().max(9, 'Cannot be more than 9 digits').regex(/^[1-9]+$/, 'Candidates must only be values 1-9').safeParse(candidateStr)
        if(!res.success) {
            return false
        }
    }
    return true;
})
