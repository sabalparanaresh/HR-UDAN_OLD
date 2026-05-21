
export let eventClients: { id: number; res: any }[] = [];
export const emitEvent = (event: string, payload: any) => {
  const data = JSON.stringify({ event, payload });
  eventClients.forEach(c => c.res.write(`data: ${data}\n\n`));
};
