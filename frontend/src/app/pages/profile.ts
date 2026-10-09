import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth-service';

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './profile.html',
})
export class ProfilePage {
  readonly auth = inject(AuthService);
}
