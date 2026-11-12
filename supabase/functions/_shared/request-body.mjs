// Bound bytes before parsing or authenticating a streamed request. No provider side effects.
export class RequestBodyError extends Error {
 constructor(code,status){super(code);this.code=code;this.status=status}
}
export async function readTextBounded(request,limit,tooLarge='payload_too_large'){
 if(Number(request.headers.get('content-length'))>limit){await request.body?.cancel().catch(()=>{});throw new RequestBodyError(tooLarge,413)}
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RequestBodyError(tooLarge,413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 }catch(error){if(error instanceof RequestBodyError)throw error;throw new RequestBodyError('invalid_body',400)}finally{reader.releaseLock()}
}
