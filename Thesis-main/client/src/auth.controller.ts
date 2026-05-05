import { AuthService } from './auth.service';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    handleLogin(req: any, res: any): void {
        const { email, password } = req.body;

        this.authService.login(email, password).pipe(
            tap(response => {
                // Side effect: Log successful login without mutating the stream
                console.log(`User ${response.user.name} logged in successfully.`);
            }),
            catchError(err => {
                res.status(401).json({ message: err.message });
                return of(null);
            })
        ).subscribe(result => {
            if (result) {
                res.status(200).json(result);
            }
        });
    }
}