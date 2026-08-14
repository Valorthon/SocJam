export const SIGNUP_ONBOARDING_PATH = "/onboarding";

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type SignupField = "name" | "email" | "password" | "confirmPassword";

export interface RegistrationResult {
  success: boolean;
  error?: string;
  fieldErrors?: Partial<Record<SignupField, string>>;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface SignupFlowDependencies {
  register: (input: SignupCredentials) => Promise<RegistrationResult>;
  login: (input: Pick<SignupCredentials, "email" | "password">) => Promise<LoginResult>;
}

export type SignupFlowResult =
  | { success: true; redirectTo: typeof SIGNUP_ONBOARDING_PATH }
  | { success: false; stage: "registration"; result: RegistrationResult }
  | { success: false; stage: "login"; result: LoginResult };

export async function completeSignupFlow(
  input: SignupCredentials,
  dependencies: SignupFlowDependencies,
): Promise<SignupFlowResult> {
  const registration = await dependencies.register(input);
  if (!registration.success) {
    return { success: false, stage: "registration", result: registration };
  }

  const login = await dependencies.login({
    email: input.email,
    password: input.password,
  });
  if (!login.success) {
    return { success: false, stage: "login", result: login };
  }

  return { success: true, redirectTo: SIGNUP_ONBOARDING_PATH };
}
