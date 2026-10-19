import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, Observable } from 'rxjs';


export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}

@Injectable()
export class GlobalResponseInterceptor implements NestInterceptor{
    intercept(
        _context: ExecutionContext, 
        next: CallHandler
    ): Observable<ApiSuccessResponse<unknown>> {
        return next.handle().pipe(
            map((data: unknown) => ({
                success: true as const,
                data: data === undefined ? null : data
            }))
        )
    }
}